import {
	IconHome,
	IconListCheck,
	IconUsersGroup,
	IconSettings,
	IconLogout,
	IconGift,
} from "@tabler/icons-react";

export type NavLink = {
	title: string;
	icon: React.ReactNode;
	href: string;
};

export const links: NavLink[] = [
	{
		title: "Home",
		href: "/landing",
		icon: <IconHome className="h-full w-full" />,
	},
	{
		title: "My Lists",
		href: "/user-lists",
		icon: <IconListCheck className="h-full w-full" />,
	},
	{
		title: "Gifts",
		href: "/purchased-items",
		icon: <IconGift className="h-full w-full" />,
	},
	{
		title: "Family",
		href: "/family-lists",
		icon: <IconUsersGroup className="h-full w-full" />,
	},
	// optional:
	{
		title: "Sign out",
		href: "/api/logout",
		icon: <IconLogout className="h-full w-full" />,
	},
];
