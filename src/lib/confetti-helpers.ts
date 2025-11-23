// src/lib/confetti-helpers.ts
import confetti from "canvas-confetti";

/**
 * Trigger festive confetti for purchase celebration
 */
export function triggerPurchaseConfetti() {
	confetti({
		particleCount: 100,
		spread: 70,
		origin: { y: 0.6 },
		colors: ["#26ccff", "#a25afd", "#ff5e7e", "#88ff5a", "#fcff42", "#ffa62d"],
	});
}

/**
 * Trigger notification confetti for special events
 */
export function triggerNotificationConfetti() {
	confetti({
		particleCount: 150,
		spread: 100,
		origin: { y: 0.5 },
		colors: ["#dc2626", "#ffffff", "#16a34a"],
		startVelocity: 45,
		gravity: 1.2,
	});
}

/**
 * Trigger continuous confetti animation for a duration
 * Used in stateful checkbox multi-step loader
 */
export function triggerContinuousConfetti(durationMs: number = 1500) {
	const animationEnd = Date.now() + durationMs;
	const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

	const randomInRange = (min: number, max: number) =>
		Math.random() * (max - min) + min;

	const interval = window.setInterval(() => {
		const timeLeft = animationEnd - Date.now();

		if (timeLeft <= 0) {
			return clearInterval(interval);
		}

		const particleCount = 50 * (timeLeft / durationMs);
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
}
