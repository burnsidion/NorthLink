// src/components/ui/page-fade.tsx
"use client";

import { motion, useReducedMotion } from "motion/react";

type Props = React.PropsWithChildren<{
	delay?: number; // seconds
	y?: number; // px translate on enter
}>;

export default function PageFade({ children, delay = 0.0, y = 6 }: Props) {
	const prefersReduced = useReducedMotion();
	if (prefersReduced) return <>{children}</>;

	return (
		<motion.div
			initial={{ opacity: 0, y }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.28, ease: "easeOut", delay }}
		>
			{children}
		</motion.div>
	);
}
