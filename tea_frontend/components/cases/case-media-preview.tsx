// import configData from "../config.json";
// import { CardMedia } from "@mui/material";
// import mockup_diagram from "../images/mockup-diagram.png";
// import { useTheme } from "@emotion/react";
// import { useEffect, useState } from "react";
// import MermaidChart from "./Mermaid";
// import { useLoginToken } from ".*/use-auth";
// import { getCase } from "./caseApi";
// import { Box } from "@mui/material";
// import { LoadingCard } from "./ManageCases";

// /**
//  * CaseMediaPreview dynamically renders a visual preview of an assurance case.
//  * Depending on the configuration, it either displays a Mermaid chart representation of the case
//  * or a static mockup image. This component is intended to enhance the user interface by providing
//  * a quick glance at the case structure or content.
//  *
//  * @param {Object} props - Component props.
//  * @param {Object} props.caseObj - The case object containing information such as the case ID.
//  * @returns {JSX.Element} A visual representation of the assurance case.
//  */
// export const CaseMediaPreview = ({ caseObj }) => {
//   const theme = useTheme();
//   const [token] = useLoginToken();
//   const [assuranceCase, setAssuranceCase] = useState();
//   const [isLoading, setIsLoading] = useState(true);

//   /**
//    * Fetch the detailed assurance case data when the component mounts.
//    *
//    * @param {string} token - The user's login token.
//    * @param {Object} caseObj - The case object containing information such as the case ID.
//    * @returns {void}
//    */
//   useEffect(() => {
//     if (token) {
//       let isMounted = true;
//       getCase(token, caseObj.id)
//         .then((json) => {
//           if (!isMounted) {
//             return;
//           }
//           setAssuranceCase(json);
//           setIsLoading(false);
//         })
//         .catch((err) => {
//           console.error(err);
//           // TODO show error to user
//         });

//       // Cleanup function to handle component unmount
//       return () => {
//         isMounted = false;
//       };
//     }
//   }, [token, caseObj]);

//   // Conditionally render the Mermaid chart or a static image based on configuration
//   if (configData.use_case_preview_svg) {
//     return (
//       <>
//         {isLoading ? (
//           <LoadingCard />
//         ) : (
//           <Box
//             sx={{
//               height: "50%",
//               position: "relative",
//               pointerEvents: "none",
//               overflow: "hidden",
//             }}
//           >
//             <MermaidChart
//               assuranceCase={assuranceCase}
//               caseId={caseObj.id}
//               selectedId={[]}
//               selectedType={[]}
//               setSelected={() => {}}
//               setMermaidFocus={() => {}}
//             />
//           </Box>
//         )}
//       </>
//     );
//   } else {
//     return (
//       <CardMedia
//         height={227}
//         component="img"
//         image={mockup_diagram}
//         alt=""
//         sx={{ background: theme.palette.grey[200] }}
//       />
//     );
//   }
// };
