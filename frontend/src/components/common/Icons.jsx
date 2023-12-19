import React from "react";
import { SvgIcon } from "@mui/material";
import { ReactComponent as AddSvg } from "../../images/add-1--expand-cross-buttons-button-more-remove-plus-add-+-mathematics-math.svg";
import { ReactComponent as ArrowTopRightSvg } from "../../images/arrow-diagonal-top-right-large--keyboard-top-arrow-right-up-large-head.svg";
import { ReactComponent as ArrowDownSvg } from "../../images/arrow-down-3--arrow-down-keyboard.svg";
import { ReactComponent as ArrowExpandSvg } from "../../images/arrow-expand--expand-small-bigger-retract-smaller-big.svg";
import { ReactComponent as ArrowExpandDiagonalSvg } from "../../images/arrow-expand-diagonal-1--expand-smaller-retract-bigger-big-small-diagonal.svg";
import { ReactComponent as ArrowLeftSvg } from "../../images/arrow-left-1--arrow-keyboard-left.svg";
import { ReactComponent as ChevronLeftSvg } from "../../images/arrow-left-3--arrow-keyboard-left.svg";
import { ReactComponent as ArrowRightSvg } from "../../images/arrow-right-1--arrow-right-keyboard.svg";
import { ReactComponent as ChevronRightSvg } from "../../images/arrow-right-3--arrow-right-keyboard.svg";
import { ReactComponent as ArrowUpSvg } from "../../images/arrow-up-3--arrow-up-keyboard.svg";
import { ReactComponent as BriefcaseSvg } from "../../images/bag-suitcase-4--product-business-briefcase.svg";
import { ReactComponent as ValidationSvg } from "../../images/check--check-form-validation-checkmark-success-add-addition-tick.svg";
import { ReactComponent as DashboardSvg } from "../../images/dashboard-square--app-application-dashboard-home-layout-square.svg";
import { ReactComponent as RemoveSvg } from "../../images/delete-1--remove-add-button-buttons-delete-cross-x-mathematics-multiply-math.svg";
import { ReactComponent as DraftSvg } from "../../images/draft.svg";
import { ReactComponent as FileSuccessSvg } from "../../images/file success_dark.svg";
import { ReactComponent as QuestionSvg } from "../../images/help-question-1--circle-faq-frame-help-info-mark-more-query-question.svg";
import { ReactComponent as NodesThreeSvg } from "../../images/hierarchy-2--node-organization-links-structure-link-nodes-network-hierarchy.svg";
import { ReactComponent as NodesTwoSvg } from "../../images/hierarchy-5--node-organization-links-structure-link-nodes-network-hierarchy.svg";
import { ReactComponent as HomeSvg } from "../../images/home-3--home-house-roof-shelter.svg";
import { ReactComponent as TargetSvg } from "../../images/location-target-2--navigation-location-map-services-maps-gps-target.svg";
import { ReactComponent as ModuleSvg } from "../../images/module--cube-code-module-programming-plugin.svg";
import { ReactComponent as BinSvg } from "../../images/recycle-bin-2--remove-delete-empty-bin-trash-garbage.svg";
import { ReactComponent as ShareSvg } from "../../images/share-link--share-transmit.svg";
import { ReactComponent as SubtractSvg } from "../../images/subtract-1--button-delete-buttons-subtract-horizontal-remove-line-add-mathematics-math-minus.svg";
import { ReactComponent as UploadSvg } from "../../images/upload-file_dark.svg";
import { ReactComponent as DownloadSvg } from "../../images/upload-tray--arrow-bottom-download-internet-network,-erver-up-upload.svg";
import { ReactComponent as VerticalMenuSvg } from "../../images/vertical-menu--navigation-vertical-three-circle-button-menu-dots.svg";
import { ReactComponent as WheelchairSvg } from "../../images/wheelchair-2--person-access-wheelchair-accomodation-human-disability-disabled-user.svg";

function Icon({ Component, ...props }) {
  return (
    <SvgIcon {...props}>
      <Component width={24} height={24} />
    </SvgIcon>
  );
}

export function Add({ ...props }) {
  return <Icon {...props} Component={AddSvg} />;
}

export function ArrowRight({ ...props }) {
  return <Icon {...props} Component={ArrowRightSvg} />;
}

export function ArrowTopRight({ ...props }) {
    return <Icon {...props} Component={ArrowTopRightSvg} />;
}

export function Bin({ ...props }) {
    return <Icon {...props} Component={BinSvg} />;
}

export function ChevronRight({ ...props }) {
    return <Icon {...props} Component={ChevronRightSvg} />;
}

export function Draft({ ...props }) {
    return <Icon {...props} Component={DraftSvg} />;
}

export function Module({ ...props }) {
  return <Icon {...props} Component={ModuleSvg} />;
}

export function NodesThree({ ...props }) {
  return <Icon {...props} Component={NodesThreeSvg} />;
}

export function Remove({ ...props }) {
  return <Icon {...props} Component={RemoveSvg} />;
}

export function Share({ ...props }) {
    return <Icon {...props} Component={ShareSvg} />;
}

export function Subtract({ ...props }) {
    return <Icon {...props} Component={SubtractSvg} />;
}

export function Target({ ...props }) {
    return <Icon {...props} Component={TargetSvg} />;
}

export function VerticalMenu({ ...props }) {
  return <Icon {...props} Component={VerticalMenuSvg} />;
}
export function Wheelchair({ ...props }) {
    return <Icon {...props} Component={WheelchairSvg} />;
}
