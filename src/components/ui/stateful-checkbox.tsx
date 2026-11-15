"use client";
import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from "react";
import { motion, useAnimate } from "motion/react";
import { MultiStepLoader } from "./multi-step-loader";
import { triggerPurchaseConfetti } from "@/lib/confetti-helpers";

interface StatefulCheckboxProps {
	checked: boolean;
	onChange: () => Promise<boolean>;
	className?: string;
	ariaLabel?: string;
	showMultiStepLoader?: boolean; // Enable festive multi-step loader for purchases
}

export const StatefulCheckbox = ({
	checked,
	onChange,
	className,
	ariaLabel,
	showMultiStepLoader = false,
}: StatefulCheckboxProps) => {
	const [scope, animate] = useAnimate();
	const [isLoading, setIsLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);

	const loadingStates = [
		{ text: "🎅 Contacting the elves..." },
		{ text: "📝 Making the list..." },
		{ text: "✨ Checking it twice..." },
		{ text: "🎁 Wrapping it up..." },
	];

	const inFlight = useRef(false);
	const mounted = useRef(true);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		mounted.current = true;
		return () => { mounted.current = false; };
	}, []);
	const animateSuccess = async () => {
		try {
			await animate(
				".loader",
				{
					scale: 0,
					opacity: 0,
				},
				{
					duration: 0.2,
				}
			);
		} catch {
			// Loader element may not exist, ignore
		}

		// Only animate checkmark if it will be checked after toggle
		if (!checked) {
			try {
				await animate(
					".checkmark",
					{
						scale: [0, 1.2, 1],
						opacity: [0, 1, 1],
					},
					{
						duration: 0.3,
					}
				);
			} catch {
				// Checkmark element may not exist yet, ignore
			}
		}
	};

	const handleClick = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		setIsLoading(true);
		setError(null);
		setShowLoader(showMultiStepLoader && !checked);
		try {
			// Save immediately. Animation must never delay or decide persistence.
			const saved = await onChange();
			if (mounted.current && saved) {
				if (!checked) {
					try { triggerPurchaseConfetti(); } catch { /* Decoration cannot fail a saved purchase. */ }
				}
				await animateSuccess();
			}
		} catch {
			if (mounted.current) setError("Could not save. Please refresh and try again.");
		} finally {
			inFlight.current = false;
			if (mounted.current) {
				setIsLoading(false);
				setShowLoader(false);
			}
		}
	};

	return (
		<>
			{error && <span role="alert" className="text-sm text-red-400">{error}</span>}
			{/* Only show multi-step loader when explicitly enabled for purchasing */}
			<MultiStepLoader
				loadingStates={loadingStates}
				loading={showLoader}
				duration={2000}
				loop={false}
			/>
			<button
				type="button"
				ref={scope}
				aria-label={ariaLabel}
				aria-busy={isLoading}
				onClick={handleClick}
				disabled={isLoading}
				className={cn(
					"relative mt-1 h-5 w-5 rounded border transition-colors flex items-center justify-center",
					checked
						? "bg-emerald-700/80 border-emerald-700"
						: "border-white/20 hover:border-white/40",
					isLoading && "cursor-wait",
					className
				)}
			>
				{/* Loader - hide when multi-step loader is active */}
				{!showLoader && (
					<motion.svg
						animate={{
							rotate: [0, 360],
							scale: isLoading ? 1 : 0,
							opacity: isLoading ? 1 : 0,
						}}
						initial={{
							scale: 0,
							opacity: 0,
						}}
						transition={{
							duration: 0.5,
							repeat: Infinity,
							ease: "linear",
						}}
						xmlns="http://www.w3.org/2000/svg"
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="loader text-white absolute"
					>
						<path stroke="none" d="M0 0h24v24H0z" fill="none" />
						<path d="M12 3a9 9 0 1 0 9 9" />
					</motion.svg>
				)}

				{/* Checkmark */}
				{checked && (
					<motion.svg
						initial={{
							scale: 0,
							opacity: 0,
						}}
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						strokeLinejoin="round"
						animate={{ scale: 1, opacity: 1 }}
						className="checkmark text-white"
					>
						<path d="M5 12l5 5l10 -10" />
					</motion.svg>
				)}
			</button>
		</>
	);
};
