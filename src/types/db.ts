export type ListRow = { id: string; title: string; created_at: string };
export type ItemRow = {
	id: string;
	list_id: string;
	title: string;
	purchased: boolean;
	created_at: string;
	price_cents: number | null;
	link: string | null;
	notes: string | null;
	most_wanted?: boolean;
	on_sale?: boolean;
};
