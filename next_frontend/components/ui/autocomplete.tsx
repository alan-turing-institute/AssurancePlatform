'use client'

import { cn } from '@/lib/utils';
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export type User = {
  name: string;
  email: string;
};

type AutoCompleteProps = {
  options: User[];
  selectedUsers: User[]; // Define the type for selectedUsers as an array of User objects
  setSelectedUsers: Dispatch<SetStateAction<User[]>>; // Update the type for setSelectedUsers
};

const AutoComplete = ({ options, selectedUsers, setSelectedUsers }: AutoCompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (inputValue.length > 0) {
      const filtered = options.filter((option) =>
        option.email.toLowerCase().includes(inputValue.toLowerCase()) &&
        !selectedUsers.some(selectedUser => selectedUser.email === option.email) // Exclude already selected users
      );
      setFilteredOptions(filtered);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, options, selectedUsers]);

  const handleInputChange = (event: any) => {
    setInputValue(event.target.value);
  };

  const handleOptionClick = (option: User) => {
    // Check if the user is already selected
    const isAlreadySelected = selectedUsers.some(
      (user) => user.email === option.email
    );

    if (!isAlreadySelected) {
      setSelectedUsers([...selectedUsers, option]); // Add the selected user to the array
    }

    setInputValue(''); // Clear the input after selection
    setIsOpen(false); // Close the dropdown
  };

  return (
    <div className="autocomplete relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 100)}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        )}
        placeholder="Start typing..."
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul
          className="absolute top-full left-0 z-50 w-full p-2 bg-gray-100 dark:bg-slate-900 rounded-md mt-1 space-y-3 shadow-lg"
        >
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => handleOptionClick(option)}
              className="hover:bg-indigo-600 hover:cursor-pointer group hover:text-white p-2 rounded-md"
            >
              {option.name}
              <span className="ml-2 text-sm text-muted-foreground group-hover:text-white">
                ({option.email})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );  
};

export default AutoComplete;
