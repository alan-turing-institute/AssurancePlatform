import { Box, IconButton, Menu } from "@mui/material";
import useId from "@mui/utils/useId";
import * as React from "react";
import { useRef } from "react";
import { VerticalMenu } from "./Icons";

function BurgerMenu({ children, isOpen, setIsOpen, ...props }) {
  const ref = useRef(null);

  const onClick = () => {
    setIsOpen(true);
  };
  const onClose = () => {
    setIsOpen(false);
  };

  const buttonId = useId();
  const menuId = useId();

  return (
    <Box {...props}>
      <IconButton
        size="small"
        ref={ref}
        aria-label="more"
        id={buttonId}
        aria-controls={isOpen ? { menuId } : undefined}
        aria-expanded={isOpen ? "true" : undefined}
        aria-haspopup="true"
        onClick={onClick}
      >
        <VerticalMenu fontSize="small" />
      </IconButton>
      <Menu
        id={menuId}
        MenuListProps={{
          "aria-labelledby": buttonId,
        }}
        anchorEl={ref.current}
        open={isOpen}
        onClose={onClose}
      >
        {children}
      </Menu>
    </Box>
  );
}

export default BurgerMenu;
