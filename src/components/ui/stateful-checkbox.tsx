"use client";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { motion, useAnimate } from "motion/react";

interface StatefulCheckboxProps {
	checked: boolean;
	onChange: () => Promise<void> | void;
	className?: string;
	ariaLabel?: string;
}

export const StatefulCheckbox = ({
	checked,
	onChange,
	className,
	ariaLabel,
}: StatefulCheckboxProps) => {
	const [scope, animate] = useAnimate();
	const [isLoading, setIsLoading] = useState(false);

	const animateLoading = async () => {
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
	};

	const animateSuccess = async () => {
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
		setIsLoading(true);
		await animateLoading();
		await onChange();
		await animateSuccess();
		setIsLoading(false);
	};

	return (
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
			{/* Loader */}
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
	);
};
