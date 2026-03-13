import { useEffect, useState } from "react";
import type { useForm } from "react-hook-form";
import type { CaseStudyFormValues } from "./form-schema";

interface UseAuthorManagementReturn {
	addAuthor: () => void;
	authors: string[];
	inputValue: string;
	removeAuthor: (authorToRemove: string) => void;
	setInputValue: React.Dispatch<React.SetStateAction<string>>;
}

export function useAuthorManagement(
	form: ReturnType<typeof useForm<CaseStudyFormValues>>
): UseAuthorManagementReturn {
	const [authors, setAuthors] = useState<string[]>([]);
	const [inputValue, setInputValue] = useState("");

	// Sync authors state with form field value
	useEffect(() => {
		const formAuthors = form.watch("authors");
		if (formAuthors) {
			const authorsArray = formAuthors
				.split(",")
				.map((a) => a.trim())
				.filter((a) => a);
			setAuthors(authorsArray);
		} else {
			setAuthors([]);
		}
	}, [form]);

	const addAuthor = () => {
		const trimmed = inputValue.trim();
		if (trimmed && !authors.includes(trimmed)) {
			const newAuthors = [...authors, trimmed];
			setAuthors(newAuthors);
			form.setValue("authors", newAuthors.join(", "));
			setInputValue(""); // Clear input
		}
	};

	const removeAuthor = (authorToRemove: string) => {
		const newAuthors = authors.filter((author) => author !== authorToRemove);
		setAuthors(newAuthors);
		form.setValue("authors", newAuthors.join(", "));
	};

	return {
		authors,
		inputValue,
		setInputValue,
		addAuthor,
		removeAuthor,
	};
}
