"use client";

import ProfileGate from "@/components/auth/profile-gate";

export default function HomeGate() {
	return <ProfileGate redirectReadyTo="/landing" />;
}
