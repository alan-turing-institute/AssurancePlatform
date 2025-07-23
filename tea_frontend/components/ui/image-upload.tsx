"use client";

import { ImageIcon, Trash2Icon, UploadIcon, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
	value?: string | File;
	onChange: (file: File | string) => void;
	onRemove?: () => void;
	disabled?: boolean;
	className?: string;
	maxSize?: number; // in bytes
	accept?: Record<string, string[]>;
}

export function ImageUpload({
	value,
	onChange,
	onRemove,
	disabled = false,
	className,
	maxSize = 5 * 1024 * 1024, // 5MB default
	accept = {
		"image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
	},
}: ImageUploadProps) {
	const [preview, setPreview] = useState<string>("");
	const [error, setError] = useState<string>("");

	const onDrop = useCallback(
		(acceptedFiles: File[], rejectedFiles: any[]) => {
			setError("");

			if (rejectedFiles.length > 0) {
				const rejection = rejectedFiles[0];
				if (rejection.errors[0]?.code === "file-too-large") {
					setError(
						`File is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
					);
				} else if (rejection.errors[0]?.code === "file-invalid-type") {
					setError("Invalid file type. Please upload an image file.");
				} else {
					setError("File upload failed. Please try again.");
				}
				return;
			}

			if (acceptedFiles.length > 0) {
				const file = acceptedFiles[0];
				const objectUrl = URL.createObjectURL(file);
				setPreview(objectUrl);
				onChange(file);
			}
		},
		[onChange, maxSize]
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept,
		maxFiles: 1,
		maxSize,
		disabled,
	});

	const handleRemove = () => {
		setPreview("");
		setError("");
		if (preview) {
			URL.revokeObjectURL(preview);
		}
		if (onRemove) {
			onRemove();
		}
		onChange("");
	};

	// Determine what image to show
	const imageToShow = preview || (typeof value === "string" ? value : "");

	return (
		<div className={cn("space-y-4", className)}>
			{imageToShow ? (
				<div className="group relative">
					<div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-lg border">
						<Image
							alt="Upload preview"
							className="object-cover"
							fill
							src={imageToShow}
						/>
					</div>
					<div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
						<Button
							disabled={disabled}
							onClick={handleRemove}
							type="button"
							variant="destructive"
						>
							<Trash2Icon className="mr-2 h-4 w-4" />
							Remove Image
						</Button>
					</div>
				</div>
			) : (
				<div
					{...getRootProps()}
					className={cn(
						"cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
						isDragActive
							? "border-primary bg-primary/5"
							: "border-muted-foreground/25 hover:border-muted-foreground/50",
						disabled && "cursor-not-allowed opacity-50",
						"focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					)}
				>
					<input {...getInputProps()} />
					<div className="flex flex-col items-center justify-center space-y-4">
						<div className="rounded-full bg-muted p-4">
							{isDragActive ? (
								<UploadIcon className="h-8 w-8 text-muted-foreground" />
							) : (
								<ImageIcon className="h-8 w-8 text-muted-foreground" />
							)}
						</div>
						<div className="space-y-2">
							<p className="font-medium text-lg">
								{isDragActive ? "Drop your image here" : "Upload an image"}
							</p>
							<p className="text-muted-foreground text-sm">
								Drag and drop an image file, or click to select
							</p>
							<p className="text-muted-foreground text-xs">
								PNG, JPG, JPEG, GIF, WEBP up to{" "}
								{Math.round(maxSize / 1024 / 1024)}MB
							</p>
						</div>
					</div>
				</div>
			)}
			{error && (
				<div className="flex items-center space-x-2 rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					<X className="h-4 w-4" />
					<span>{error}</span>
				</div>
			)}
		</div>
	);
}
