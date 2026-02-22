"use client";

import { NextStep, NextStepProvider } from "nextstepjs";
import type { ReactNode } from "react";
import TourCard from "@/components/common/tour-card";
import { caseCanvasTour } from "@/lib/tours/case-canvas-tour";
import { dashboardTour } from "@/lib/tours/dashboard-tour";

const tours = [dashboardTour, caseCanvasTour];

type TourProviderProps = {
	children: ReactNode;
};

export function TourProvider({ children }: TourProviderProps) {
	return (
		<NextStepProvider>
			<NextStep
				cardComponent={TourCard}
				clickThroughOverlay={false}
				displayArrow={true}
				shadowOpacity="0.6"
				steps={tours}
			>
				{children}
			</NextStep>
		</NextStepProvider>
	);
}
