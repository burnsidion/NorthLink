"use client";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { motion, useAnimate } from "motion/react";
import { MultiStepLoader } from "./multi-step-loader";
import confetti from "canvas-confetti";

interface StatefulCheckboxProps {
	checked: boolean;
	onChange: () => Promise<void> | void;
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

	const triggerConfetti = () => {
		const duration = 1.5 * 1000;
		const animationEnd = Date.now() + duration;
		const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

		const randomInRange = (min: number, max: number) =>
			Math.random() * (max - min) + min;

		const interval = window.setInterval(() => {
			const timeLeft = animationEnd - Date.now();

			if (timeLeft <= 0) {
				return clearInterval(interval);
			}

			const particleCount = 50 * (timeLeft / duration);
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
			});
			confetti({
				...defaults,
				particleCount,
				origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
			});
		}, 250);
	};

	const animateLoading = async () => {
		try {
			await animate(
				".loader",
				{
					scale: 1,
					opacity: 1,
				},
				{
					duration: 0.2,
				}
			);
		} catch (e) {
			// Loader element may not exist, ignore
		}
	};

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
		} catch (e) {
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
			} catch (e) {
				// Checkmark element may not exist yet, ignore
			}
		}
	};

	const handleClick = async () => {
		// If multi-step loader is enabled and we're purchasing (unchecked -> checked)
		if (showMultiStepLoader && !checked) {
			setIsLoading(true);
			setShowLoader(true);

			// Wait for multi-step loader to complete (8 seconds)
			setTimeout(async () => {
				// Execute the purchase
				await onChange();

				// Show confetti celebration
				triggerConfetti();

				// Wait a bit for confetti to start, then allow interaction again
				setTimeout(() => {
					setIsLoading(false);
					setShowLoader(false);
				}, 500);
			}, 8000);
		} else {
			// For unpurchasing (checked -> unchecked) or when multi-step is disabled
			// Use the simple loading animation - NO multi-step loader
			setIsLoading(true);
			setShowLoader(false);
			await animateLoading();
			await onChange();
			await animateSuccess();
			setIsLoading(false);
		}
	};

	return (
		<>
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
						className="checkmark text-white"
					>
						<path d="M5 12l5 5l10 -10" />
					</motion.svg>
				)}
			</button>
		</>
	);
};
