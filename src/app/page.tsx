import styles from "./page.module.css";

// homepage
// hero
// copy
// demos
// pricing
// contact
// agents | genesiss | bytesize

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroImage}>
          <div className={styles.heroPattern}></div>
        </div>
        
        <div className={styles.heroText}>
            <h1>GENESISS <span className={styles.herospan}>AGENTS</span></h1>
            <p>AI-powered knowledge discovery</p>
        </div>
      </div>
      <div className={styles.copy}></div>
      <div className={styles.demos}></div>
      <div className={styles.pricing}></div>
      <div className={styles.contact}></div>
      <div className={styles.bottomCardsTitle}>Learn more about our other products:</div>
      <div className={styles.bottomCards}>
        <div className={styles.agents}>
          <a href="https://agents.genesiss.tech">
            <div className={styles.agentsPattern}></div>
            <div className={styles.gCardText}>
              Genesiss Agents
            </div>
          </a>
        </div>
        <div className={styles.genesiss}>
         <a href="https://www.genesiss.tech"> 
          <div className={styles.genesissPattern}></div>
          <div className={styles.gCardText}>
            Genesiss AI API
          </div>
        </a>
        </div>
        <div className={styles.bytesize}>
          <a href="https://bytesize.world">
            <div className={styles.bytesizePattern}></div>
            <div className={styles.gCardText}>
              Bytesize
            </div>
          </a>
        </div>
      </div>
      <footer className={styles.footer}></footer>
    </div>
  );
}
