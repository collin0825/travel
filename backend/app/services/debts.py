"""Splitwise-style debt settlement.

Given a set of expenses and the itinerary's members, compute the minimal set of
"who pays whom" transfers that settles all balances (greedy: largest debtor pays
largest creditor, repeat).
"""

from typing import Dict, List, Sequence

from app import schemas
from app.db import models


def calculate_settlements(
    expenses: Sequence[models.Expense],
    members: Sequence[models.User],
) -> List[schemas.DebtCalculation]:
    # 1. Initialize a zero balance for every member.
    balances: Dict[int, float] = {m.id: 0.0 for m in members}
    member_dict = {m.id: m for m in members}

    # 2. Credit payers, debit each participant their share.
    for exp in expenses:
        if exp.paid_by in balances:
            balances[exp.paid_by] += exp.amount

        participants = exp.splits or list(members)  # default: split across all members
        if not participants:
            continue

        share = exp.amount / len(participants)
        for part in participants:
            if part.id in balances:
                balances[part.id] -= share

    # 3. Separate into debtors (owe money) and creditors (are owed money).
    debtors = []   # (user_id, amount_owed)
    creditors = []  # (user_id, amount_credited)
    for uid, bal in balances.items():
        if bal < -0.01:
            debtors.append((uid, -bal))
        elif bal > 0.01:
            creditors.append((uid, bal))

    debtors.sort(key=lambda x: x[1], reverse=True)
    creditors.sort(key=lambda x: x[1], reverse=True)

    # 4. Greedily match largest debtor to largest creditor.
    debts: List[schemas.DebtCalculation] = []
    d_idx, c_idx = 0, 0
    while d_idx < len(debtors) and c_idx < len(creditors):
        debtor_id, owed = debtors[d_idx]
        creditor_id, credited = creditors[c_idx]

        settled_val = min(owed, credited)
        debts.append(
            schemas.DebtCalculation(
                from_user=schemas.UserResponse.model_validate(member_dict[debtor_id]),
                to_user=schemas.UserResponse.model_validate(member_dict[creditor_id]),
                amount=round(settled_val, 2),
            )
        )

        owed -= settled_val
        credited -= settled_val

        if owed < 0.01:
            d_idx += 1
        else:
            debtors[d_idx] = (debtor_id, owed)

        if credited < 0.01:
            c_idx += 1
        else:
            creditors[c_idx] = (creditor_id, credited)

    return debts
