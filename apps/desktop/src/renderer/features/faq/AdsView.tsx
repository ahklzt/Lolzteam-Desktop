import { HtmlPage } from "./HtmlPage";
import { ADS_PAGE } from "./pages";
import adsCss from "./site-css/ads-reference.css?raw";
import styles from "./FaqView.module.scss";

export const AdsView = () => (
  <div className={styles.wrap}>
    <section className={styles.content}>
      <HtmlPage html={ADS_PAGE} className={styles.frame} extraCss={adsCss} />
    </section>
  </div>
);
