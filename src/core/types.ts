export type TripKind = 'business' | 'private' | 'commute';
export type TripSource = 'gps' | 'obd' | 'manual';
export type TripStatus = 'recording' | 'open' | 'done' | 'void';

export type GeoPoint = { lat: number; lng: number };

export type Trip = {
  id: string;
  vehicleId: string;
  number: number;
  status: TripStatus;
  source: TripSource;
  startedAt: number;
  endedAt: number | null;
  odoStart: number;
  odoEnd: number | null;
  startAddress: string;
  endAddress: string;
  startPoint: GeoPoint | null;
  endPoint: GeoPoint | null;
  kind: TripKind | null;
  purpose: string;
  partner: string;
  route: string;
  driver: string;
  note: string;
  gpsMeters: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  lockedAt: number | null;
  voidReason: string;
};

export type TripPatch = Partial<
  Pick<
    Trip,
    | 'startedAt'
    | 'endedAt'
    | 'odoStart'
    | 'odoEnd'
    | 'startAddress'
    | 'endAddress'
    | 'startPoint'
    | 'endPoint'
    | 'kind'
    | 'purpose'
    | 'partner'
    | 'route'
    | 'driver'
    | 'note'
    | 'gpsMeters'
  >
>;

export type Vehicle = {
  id: string;
  name: string;
  plate: string;
  odometerInitial: number;
  createdAt: number;
  adapterId: string | null;
  adapterName: string | null;
  vin: string | null;
  listPrice: number | null;
  gpsFactor: number;
  archived: boolean;
};

export type Place = {
  id: string;
  name: string;
  address: string;
  point: GeoPoint | null;
  radius: number;
  kind: TripKind | null;
  purpose: string;
  partner: string;
  role: 'home' | 'work' | null;
  createdAt: number;
};

export type CostCategory = 'fuel' | 'service' | 'insurance' | 'tax' | 'leasing' | 'other';

export type Cost = {
  id: string;
  vehicleId: string;
  date: number;
  category: CostCategory;
  amount: number;
  note: string;
  createdAt: number;
};

export type LedgerAction = 'create' | 'update' | 'complete' | 'lock' | 'void' | 'annotate';

export type LedgerEntry = {
  seq: number;
  at: number;
  entity: 'trip' | 'vehicle';
  entityId: string;
  action: LedgerAction;
  payload: string;
  prevHash: string;
  hash: string;
};

export type FieldChange = { field: keyof TripPatch; from: unknown; to: unknown };

export type TripEvent = {
  seq: number;
  at: number;
  action: LedgerAction;
  changes: FieldChange[];
  text: string;
  hash: string;
};
