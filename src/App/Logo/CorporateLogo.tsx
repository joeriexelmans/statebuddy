import { AllHTMLAttributes } from "react";
import corporateLogo from "../../../artwork/corporate-logo/StateBOSS-logo-alt.webp";

export function CorporateLogo(props: AllHTMLAttributes<HTMLImageElement>) {
  return <img style={{maxWidth: '100%'}} {...props} src={corporateLogo}/>;
}
