export interface TransportStop {
  id: string;
  locationName: string;
  customerName: string;
  contactNumber: string;
  perStopToll: number;
}

export interface TransportData {
  routeId: string;
  startLocation: string;
  stops: TransportStop[];
  returnToGodown: boolean;
  totalKm: number;
  ratePerKm: number;
  minimumCharge: number;
  commonToll: number;
  loadingCharge: number;
  waitingCharge: number;
  advancePaid: number;
  assignedDriverId: number | null;
}

export interface TransportResult {
  kmCost: number;
  stopTollTotal: number;
  totalToll: number;
  totalCost: number;
  balancePayable: number;
}

export function calcTransport(t: TransportData): TransportResult {
  const kmCost = Math.max(t.totalKm * t.ratePerKm, t.minimumCharge > 0 ? t.minimumCharge : 0);
  const stopTollTotal = t.stops.reduce((sum, s) => sum + s.perStopToll, 0);
  const totalToll = t.commonToll + stopTollTotal;
  const totalCost = kmCost + totalToll + t.loadingCharge + t.waitingCharge;
  const balancePayable = totalCost - t.advancePaid;
  return { kmCost, stopTollTotal, totalToll, totalCost, balancePayable };
}

export function newStopId(): string {
  return "stop_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function newRouteId(): string {
  return "tr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function emptyTransportData(baseLocation: string, ratePerKm: number): TransportData {
  return {
    routeId: newRouteId(),
    startLocation: baseLocation,
    stops: [{ id: newStopId(), locationName: "", customerName: "", contactNumber: "", perStopToll: 0 }],
    returnToGodown: true,
    totalKm: 0,
    ratePerKm,
    minimumCharge: 0,
    commonToll: 0,
    loadingCharge: 0,
    waitingCharge: 0,
    advancePaid: 0,
    assignedDriverId: null,
  };
}

export interface TransportSyncPayload {
  projectId: string;
  projectName: string;
  clientName: string;
  siteLocation: string;
  transport: TransportData;
  result: TransportResult;
}
