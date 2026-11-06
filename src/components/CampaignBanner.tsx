import { CategoryArt } from "./CategoryArt";
import { Icon } from "./Icon";

export function CampaignBanner() {
  return <a href="/experts" className="care-campaign">
    <div className="campaign-copy"><span>집에서도, 가까운 센터에서도</span><h2>퇴원 후 첫 운동,<br className="campaign-mobile-break" /> 나에게 맞는 전문가와 함께</h2></div>
    <div className="campaign-art" aria-hidden="true"><div className="campaign-paper"><span /><i /><i /><i /><b><Icon name="check" size={24} /></b></div><CategoryArt kind="joint" large /></div>
    <span className="campaign-next"><Icon name="chevron" size={22} /></span>
  </a>;
}
