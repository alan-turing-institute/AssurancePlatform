"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type AutoCompleteProps = {
	options: User[];
	selectedUsers: User[]; // Define the type for selectedUsers as an array of User objects
	setSelectedUsers: Dispatch<SetStateAction<User[]>>; // Update the type for setSelectedUsers
};

const AutoComplete = ({
	options,
	selectedUsers,
	setSelectedUsers,
}: AutoCompleteProps) => {
	const [inputValue, setInputValue] = useState("");
	const [filteredOptions, setFilteredOptions] = useState<User[]>([]);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		if (inputValue.length > 0) {
			const filtered = options.filter(
				(option) =>
					option.username.toLowerCase().includes(inputValue.toLowerCase()) &&
					!selectedUsers.some(
						(selectedUser) => selectedUser.username === option.username
					) // Exclude already selected users
			);
			setFilteredOptions(filtered);
			setIsOpen(true);
		} else {
			setIsOpen(false);
		}
	}, [inputValue, options, selectedUsers]);

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(event.target.value);
	};

	const handleOptionClick = (option: User) => {
		// Check if the user is already selected
		const isAlreadySelected = selectedUsers.some(
			(user) => user.username === option.username
		);

		if (!isAlreadySelected) {
			setSelectedUsers([...selectedUsers, option]); // Add the selected user to the array
		}

		setInputValue(""); // Clear the input after selection
		setIsOpen(false); // Close the dropdown
	};

	return (
		<div className="autocomplete relative">
			<input
				className={cn(
					"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				)}
				onBlur={() => setTimeout(() => setIsOpen(false), 100)}
				onChange={handleInputChange}
				onFocus={() => setIsOpen(true)}
				placeholder="Start typing..."
				type="text"
				value={inputValue}
			/>
			{isOpen && filteredOptions.length > 0 && (
				<select
					className="absolute top-full left-0 z-50 mt-1 w-full space-y-3 rounded-md bg-gray-100 p-2 shadow-lg dark:bg-slate-900"
					size={Math.min(filteredOptions.length, 5)}
				>
					{filteredOptions.map((option) => (
						<option
							className="group rounded-md p-2 hover:cursor-pointer hover:bg-indigo-600 hover:text-white"
							key={option.id}
							onClick={() => handleOptionClick(option)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									handleOptionClick(option);
								}
							}}
							value={option.username}
						>
							{option.username}
							{option.email ? ` (${option.email})` : ""}
						</option>
					))}
				</select>
			)}
		</div>
	);
};

export default AutoComplete;
