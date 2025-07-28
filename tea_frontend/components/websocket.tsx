"use client";

import { X } from "lucide-react";
import { useSession } from "next-auth/react";
// import { useLoginToken } from '.*/use-auth';
import { useEffect, useRef, useState } from "react";
import useStore from "@/data/store";
import { usePrevious } from "@/hooks/use-previous";
import { Button } from "./ui/button";

const WebSocketComponent = () => {
	const { assuranceCase, setAssuranceCase, activeUsers, setActiveUsers } =
		useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const [messages, setMessages] = useState<string[]>([]);
	const [debug, setDebug] = useState<boolean>(false);

	// const wsUrl = `wss://staging-eap-backend.azurewebsites.net/ws/case/${assuranceCase.id}/?token=${token}`;
	const pingInterval = 1200;

	const websocketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		if (!assuranceCase?.id) {
			return;
		}

		// Construct WebSocket URL with proper protocol handling
		const apiUrl = process.env.NEXT_PUBLIC_API_URL;
		if (!apiUrl) {
			return;
		}

		let webSocketUrl: string;
		if (apiUrl.startsWith("https://")) {
			webSocketUrl = apiUrl.replace("https://", "wss://");
		} else if (apiUrl.startsWith("http://")) {
			webSocketUrl = apiUrl.replace("http://", "ws://");
		} else {
			return;
		}

		if (!session?.key) {
			return;
		}

		let interval: NodeJS.Timeout;
		const wsUrl = `${webSocketUrl}/ws/case/${assuranceCase.id}/?token=${session.key}`;

		const setupWebSocket = () => {
			const websocket = new WebSocket(wsUrl);
			websocketRef.current = websocket; // Store the WebSocket instance in the ref

			websocket.addEventListener("open", (_event: Event) => {
				const pingMessage = JSON.stringify({ content: "ping" });

				// Send an initial ping message and start ping interval
				websocket.send(pingMessage);
				interval = setInterval(() => {
					websocket.send(pingMessage);
				}, pingInterval);
			});

			websocket.addEventListener("message", (event: MessageEvent) => {
				setMessages((prevMessages) => [
					...prevMessages,
					`Received "${event.data}" from server.`,
				]);

				const data = JSON.parse(event.data);

				// Handle current connections update
				if (data.content.current_connections) {
					const users = data.content.current_connections;
					setActiveUsers(users); // Update active users
				}

				// Handle assurance case updates (only updating the goals)
				if (data.content.assuranceCase) {
					const updatedGoals = data.content.assuranceCase.goals;
					// Merge updated goals into the existing assurance case
					const updatedAssuranceCase = {
						...assuranceCase,
						goals: updatedGoals,
					};
					setAssuranceCase(updatedAssuranceCase); // Only update the goals
				}
			});

			websocket.addEventListener("close", (_event: CloseEvent) => {
				clearInterval(interval);
			});

			websocket.addEventListener("error", (_event: Event) => {
				// Check if it's a connection error
				if (
					websocket.readyState === WebSocket.CLOSED ||
					websocket.readyState === WebSocket.CLOSING
				) {
					// Connection error handling - could add logging here if needed
				}
			});
		};

		// Initialize the WebSocket connection
		setupWebSocket();

		// Cleanup function to close WebSocket and clear interval on unmount
		return () => {
			if (
				websocketRef.current &&
				websocketRef.current.readyState === WebSocket.OPEN
			) {
				websocketRef.current.close();
			}
			clearInterval(interval);
		};
	}, [
		assuranceCase?.id,
		session?.key,
		setActiveUsers,
		setAssuranceCase,
		assuranceCase,
	]); // Run effect when assuranceCase.id or token changes

	const prevAssuranceCaseString = usePrevious(JSON.stringify(assuranceCase));

	useEffect(() => {
		if (
			websocketRef.current &&
			websocketRef.current.readyState === WebSocket.OPEN &&
			prevAssuranceCaseString !== JSON.stringify(assuranceCase)
		) {
			const message = JSON.stringify({
				type: "case_message",
				content: { assuranceCase },
			});
			websocketRef.current.send(message);
		}
	}, [assuranceCase, prevAssuranceCaseString]); // Only re-run when the assuranceCase structure actually changes

	return (
		<div
			className={`${debug ? "absolute" : "hidden"} top-0 left-0 z-50 h-full w-full rounded-md bg-background p-4`}
		>
			<h1 className="mb-2">WebSocket | Users</h1>
			<div className="output">
				<p>Active Users: {activeUsers.length}</p>
				{messages.map((message, index) => (
					<p key={`msg-${index}-${message.substring(0, 10)}`}>{message}</p>
				))}
			</div>
			<Button
				className="absolute top-2 right-2"
				onClick={() => setDebug(false)}
				size={"sm"}
				variant={"ghost"}
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
};

export default WebSocketComponent;
