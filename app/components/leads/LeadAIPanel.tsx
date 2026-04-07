"use client";

import { Lead } from "@/lib/types";
import AiCoachChat from "@/components/ai/AiCoachChat";

interface Props {
  lead: Lead;
  lastNote?: string;
}

export default function LeadAIPanel({ lead }: Props) {
  return (
    <AiCoachChat
      compact
      leadContext={{
        address: lead.address,
        status: lead.status,
        att_available: lead.carrier_availability?.att ?? undefined,
        customer_name: lead.customer_name ?? null,
      }}
    />
  );
}
