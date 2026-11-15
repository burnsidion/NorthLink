"use client";

import { useEffect, type RefObject } from "react";

/** Keep keyboard focus inside an open dialog and return it to its trigger. */
export function useDialogFocus(open: boolean, ref: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		if (!open || !ref.current) return;
		const dialog = ref.current;
		const previous = document.activeElement;
		const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
			'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
		)).filter(element => !element.closest('[inert], [hidden]'));
		const focusFirst = () => (controls()[0] ?? dialog).focus();
		focusFirst();
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const elements = controls();
			const first = elements[0];
			const last = elements[elements.length - 1];
			if (!first) { event.preventDefault(); dialog.focus(); return; }
			if (!dialog.contains(document.activeElement)) {
				event.preventDefault(); (event.shiftKey ? last : first).focus();
			} else if (event.shiftKey && document.activeElement === first) {
				event.preventDefault(); last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault(); first.focus();
			}
		};
		const onFocus = (event: FocusEvent) => {
			if (!dialog.contains(event.target as Node)) focusFirst();
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("focusin", onFocus);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("focusin", onFocus);
			if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
		};
	}, [open, ref]);
}
