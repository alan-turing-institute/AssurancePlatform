"use client";

import type { useForm } from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { sectors } from "@/config/index";
import { cn } from "@/lib/utils";
import type { CaseStudyFormValues } from "./form-schema";

export type BasicInformationSectionProps = {
	form: ReturnType<typeof useForm<CaseStudyFormValues>>;
	className?: string;
};

export function BasicInformationSection({
	form,
	className,
}: BasicInformationSectionProps) {
	return (
		<div className={cn("space-y-6", className)}>
			<div>
				<h3 className="font-medium text-lg">Basic Information</h3>
				<p className="text-muted-foreground text-sm">
					Provide the essential details about your case study
				</p>
			</div>

			<div className="grid grid-cols-2 gap-8">
				<FormField
					control={form.control}
					name="title"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Title</FormLabel>
							<FormControl>
								<Input {...field} placeholder="Enter a descriptive title" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="sector"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Sector</FormLabel>
							<FormControl>
								<Select
									defaultValue={field.value}
									onValueChange={field.onChange}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select sector" />
									</SelectTrigger>
									<SelectContent>
										{sectors.map((sector) => (
											<SelectItem key={sector.ID} value={sector.Name}>
												{sector.Name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				{/* <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} defaultValue={field.value} >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {["AI", "Business", "Health", "Education"].map((sector) => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        /> */}
				<FormField
					control={form.control}
					name="type"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Type</FormLabel>
							<FormControl>
								<Select
									defaultValue={field.value}
									onValueChange={field.onChange}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										{["Assurance Case", "Argument Pattern"].map((sector) => (
											<SelectItem key={sector} value={sector}>
												{sector}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>
		</div>
	);
}
