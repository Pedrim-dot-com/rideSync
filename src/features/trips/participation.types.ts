// Contract for migration 202610240004, pending remote application/type generation.
export type TripMember = {
  user_id: string;
  role: string;
  display_name: string;
  username: string | null;
  motorcycle_brand: string | null;
  motorcycle_model: string | null;
};
export type TripInvitation = {
  invitation_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  response: string | null;
  revoked_at: string | null;
};
export type ParticipationFunctions = {
  create_trip_invitation: {
    Args: { p_trip_id: string };
    Returns: { invitation_id: string; token: string; expires_at: string }[];
  };
  list_trip_invitations: {
    Args: { p_trip_id: string };
    Returns: TripInvitation[];
  };
  revoke_trip_invitation: {
    Args: { p_trip_id: string; p_invitation_id: string };
    Returns: undefined;
  };
  respond_trip_invitation: {
    Args: { p_token: string; p_accept: boolean };
    Returns: string | null;
  };
  list_trip_members: { Args: { p_trip_id: string }; Returns: TripMember[] };
  set_trip_motorcycle: {
    Args: { p_trip_id: string; p_motorcycle_id: string | null };
    Returns: undefined;
  };
};
