import {
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  Plane,
  Route,
  TrainFront,
  TramFront,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TransportMode {
  value: string;
  label: string;
  Icon: LucideIcon;
}

export const TRANSPORT_MODES: TransportMode[] = [
  { value: 'walk', label: '步行', Icon: Footprints },
  { value: 'transit', label: '大眾運輸', Icon: TramFront },
  { value: 'bus', label: '公車', Icon: Bus },
  { value: 'train', label: '火車', Icon: TrainFront },
  { value: 'car', label: '開車', Icon: Car },
  { value: 'taxi', label: '計程車', Icon: CarTaxiFront },
  { value: 'bike', label: '自行車', Icon: Bike },
  { value: 'flight', label: '飛機', Icon: Plane },
  { value: 'other', label: '其他', Icon: Route },
];

export const findTransportMode = (value: string | null): TransportMode | undefined =>
  TRANSPORT_MODES.find((mode) => mode.value === value);
