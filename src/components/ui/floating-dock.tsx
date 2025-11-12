"use client";

import { cn } from "@/lib/utils";
import { IconLayoutNavbarCollapse } from "@tabler/icons-react";
import {
	AnimatePresence,
	MotionValue,
	motion,
	useMotionValue,
	useSpring,
	useTransform,
} from "motion/react";

import { useRef, useState } from "react";

type DockItem = { title: string; icon: React.ReactNode; href: string };

export const FloatingDock = ({
	items = [],
	desktopClassName,
	mobileClassName,
}: {
	items?: DockItem[];
	desktopClassName?: string;
	mobileClassName?: string;
}) => {
	return (
		<>
			<FloatingDockDesktop items={items ?? []} className={desktopClassName} />
			<FloatingDockMobile items={items ?? []} className={mobileClassName} />
		</>
	);
};

const FloatingDockMobile = ({
	items,
	className,
}: {
	items: { title: string; icon: React.ReactNode; href: string }[];
	className?: string;
}) => {
	const [open, setOpen] = useState(false);

	return (
		<div
			className={cn(
				"fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-50 flex items-end justify-center md:hidden",
				className
			)}
		>
			{/* Row that expands left↔right above the button */}
			<AnimatePresence>
				{open && (
					<motion.div
						key="dock-row"
						initial={{ opacity: 0, y: 8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.98 }}
						transition={{ duration: 0.18 }}
						className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-10 rounded-full bg-emerald-700/80 px-4 py-2 backdrop-blur-md border border-emerald-700/50"
					>
						{items.map((item) => (
							<a
								key={item.title}
								href={item.href}
								onClick={() => setOpen(false)}
								className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600"
							>
								<div className="h-5 w-5 text-white">{item.icon}</div>
							</a>
						))}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Toggle button */}
			<button
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-label={open ? "Close navigation" : "Open navigation"}
				className="block h-14 w-14 aspect-square p-0 appearance-none rounded-full border border-emerald-700/50 bg-emerald-700/80 shadow-lg shadow-black/40 backdrop-blur-md md:hidden touch-manipulation active:scale-95"
			>
				<IconLayoutNavbarCollapse className="h-6 w-6 text-white mx-auto my-auto" />
			</button>
		</div>
	);
};

const FloatingDockDesktop = ({
	items = [],
	className,
}: {
	items?: DockItem[];
	className?: string;
}) => {
	let mouseX = useMotionValue(Infinity);
	if (!items || items.length === 0) {
		return null;
	}
	return (
		<motion.div
			onMouseMove={(e) => mouseX.set(e.pageX)}
			onMouseLeave={() => mouseX.set(Infinity)}
			className={cn(
				"mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-emerald-700/80 px-4 pb-3 md:flex",
				className
			)}
		>
			{items.map((item) => (
				<IconContainer mouseX={mouseX} key={item.title} {...item} />
			))}
		</motion.div>
	);
};

function IconContainer({
	mouseX,
	title,
	icon,
	href,
}: {
	mouseX: MotionValue;
	title: DockItem["title"];
	icon: DockItem["icon"];
	href: DockItem["href"];
}) {
	let ref = useRef<HTMLDivElement>(null);

	let distance = useTransform(mouseX, (val) => {
		let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

		return val - bounds.x - bounds.width / 2;
	});

	let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
	let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);

	let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
	let heightTransformIcon = useTransform(
		distance,
		[-150, 0, 150],
		[20, 40, 20]
	);

	let width = useSpring(widthTransform, {
		mass: 0.1,
		stiffness: 150,
		damping: 12,
	});
	let height = useSpring(heightTransform, {
		mass: 0.1,
		stiffness: 150,
		damping: 12,
	});

	let widthIcon = useSpring(widthTransformIcon, {
		mass: 0.1,
		stiffness: 150,
		damping: 12,
	});
	let heightIcon = useSpring(heightTransformIcon, {
		mass: 0.1,
		stiffness: 150,
		damping: 12,
	});

	const [hovered, setHovered] = useState(false);

	return (
		<a href={href}>
			<motion.div
				ref={ref}
				style={{ width, height }}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
				className="relative flex aspect-square items-center justify-center rounded-full bg-red-600"
			>
				<AnimatePresence>
					{hovered && (
						<motion.div
							initial={{ opacity: 0, y: 10, x: "-50%" }}
							animate={{ opacity: 1, y: 0, x: "-50%" }}
							exit={{ opacity: 0, y: 2, x: "-50%" }}
							className="absolute -top-8 left-1/2 w-fit rounded-md border border-emerald-700 bg-emerald-700/95 px-2 py-0.5 text-xs whitespace-pre text-white"
						>
							{title}
						</motion.div>
					)}
				</AnimatePresence>
				<motion.div
					style={{ width: widthIcon, height: heightIcon }}
					className="flex items-center justify-center text-white"
				>
					{icon}
				</motion.div>
			</motion.div>
		</a>
	);
}
