import { TripVoice } from "../voice/TripVoice";
import type { TripDetail } from "./api";
import { RouteControls } from "./RouteControls";
import { TrackingControls } from "../tracking/TrackingControls";
import { useTracking } from "../tracking/useTracking";
export function TripJourney({
  detail,
  userId,
}: {
  detail: TripDetail;
  userId: string;
}) {
  const tracking = useTracking(detail.trip, userId);
  return (
    <div className="journey-layout">
      <RouteControls
        detail={detail}
        userId={userId}
        positions={tracking.positions}
        now={tracking.now}
      />
      <div className="journey-controls">
        <TrackingControls
          tracking={tracking}
          owner={detail.trip.created_by === userId}
          hasRoute={Boolean(detail.route)}
        />
        <TripVoice
          tripId={detail.trip.id}
          userId={userId}
          owner={detail.trip.created_by === userId}
          active={tracking.active}
        />
      </div>
    </div>
  );
}
