"use client";

import { useRouter } from "next/navigation";
import CaptureLeadModal from "@/components/map/CaptureLeadModal";

interface Props {
  lat: number;
  lng: number;
  address?: string;
}

/**
 * Standalone "Add Lead" route that just hosts the existing CaptureLeadModal.
 * Linked from the "+ Add Lead" button on /leads (previously a dead link).
 *
 * lat/lng are optional — the modal already lets the rep type an address
 * if they don't have coordinates.
 */
export default function NewLeadClient({ lat, lng, address }: Props) {
  const router = useRouter();
  return (
    <CaptureLeadModal
      info={{ lat, lng, address }}
      onClose={() => router.push("/leads")}
      onCreated={() => router.push("/leads")}
    />
  );
}
