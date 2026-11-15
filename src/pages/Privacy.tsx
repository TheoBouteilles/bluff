import type { ReactNode } from 'react'
import BackLink from '../components/BackLink'
import { Screen, TitleBar } from '../components/ui'
import { CONTACT_EMAIL, PRIVACY_UPDATED } from '../data/legal'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-frame p-4 font-sans text-sm leading-relaxed text-mist">
      <h2 className="mb-2 font-display text-xl font-bold uppercase tracking-wider text-paper">{title}</h2>
      {children}
    </section>
  )
}

const Li = ({ children }: { children: ReactNode }) => <li className="ml-4 list-disc">{children}</li>

// Politique de confidentialité (exigée aussi par Google pour la connexion « Continuer avec Google »)
export default function Privacy() {
  const contact = CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold underline">{CONTACT_EMAIL}</a>
    : <span className="text-gold">l’adresse de contact du jeu</span>

  return (
    <Screen>
      <div className="sticky top-0 z-30 -mt-2 bg-night py-2">
        <TitleBar title="Confidentialité" left={<BackLink />} />
      </div>
      <p className="font-sans text-xs text-mist-d">Dernière mise à jour : {PRIVACY_UPDATED}</p>

      <Section title="En bref">
        <p>
          Bluff est un jeu de société en ligne gratuit et non commercial, joué entre amis. Il ne collecte que ce qui est
          nécessaire pour jouer : pas de publicité, pas de revente de données, pas de mesure d’audience.
        </p>
      </Section>

      <Section title="Données utilisées">
        <ul className="flex flex-col gap-1">
          <Li><strong className="text-paper">Sans compte (invité)</strong> : un identifiant technique anonyme créé automatiquement, le pseudo que tu choisis, ton avatar, et tes actions pendant les parties (lieux, votes, jetons).</Li>
          <Li><strong className="text-paper">Avec un compte</strong> : ton adresse e-mail. Avec Google, nous recevons aussi les informations de base de ton compte Google (nom, adresse e-mail, photo de profil) ; seule l’adresse e-mail sert, à te connecter.</Li>
          <Li><strong className="text-paper">Profil et préférences</strong> : pseudo, avatar personnalisé, réglages de son.</Li>
          <Li><strong className="text-paper">Statistiques</strong> : résultats de tes parties terminées et trophées, visibles par toi seul. Des totaux anonymes de toutes les parties (sans pseudo ni identifiant) servent à équilibrer le jeu.</Li>
        </ul>
      </Section>

      <Section title="À quoi elles servent">
        <ul className="flex flex-col gap-1">
          <Li>Faire fonctionner les parties (salons, rôles, nuits, votes).</Li>
          <Li>Te permettre de te connecter et de retrouver ton profil et tes statistiques sur tous tes appareils.</Li>
          <Li>Améliorer l’équilibre du jeu à partir de statistiques anonymes.</Li>
        </ul>
        <p className="mt-2">Ces traitements sont nécessaires au service que tu demandes en utilisant le jeu.</p>
      </Section>

      <Section title="Où elles sont stockées">
        <ul className="flex flex-col gap-1">
          <Li><strong className="text-paper">Supabase</strong> : base de données et connexion, serveurs en Irlande (Union européenne).</Li>
          <Li><strong className="text-paper">Vercel</strong> : hébergement du site.</Li>
          <Li>Un service d’envoi d’e-mails, uniquement pour t’envoyer ton code ou ton lien de connexion.</Li>
          <Li>Sur ton appareil (stockage local du navigateur) : ta session, tes préférences, les astuces déjà vues et le dernier salon visité, ainsi qu’une copie des fichiers du jeu pour qu’il s’ouvre plus vite. Pas de cookie publicitaire.</Li>
        </ul>
        <p className="mt-2">Les rôles et les actions secrètes des autres joueurs ne sont jamais visibles pendant la partie. À la fin de la partie, les rôles, les lieux visités, les actions de nuit et les trophées gagnés sont révélés aux joueurs du salon ; les votes individuels restent secrets.</p>
      </Section>

      <Section title="Combien de temps">
        <ul className="flex flex-col gap-1">
          <Li>Les salons et les détails des parties sont supprimés automatiquement après 2 heures d’inactivité.</Li>
          <Li>Ton compte, ton profil et tes statistiques sont conservés tant que tu ne demandes pas leur suppression.</Li>
        </ul>
      </Section>

      <Section title="Tes droits">
        <p>
          Tu peux modifier ton pseudo et ton avatar à tout moment depuis la page Profil. Pour consulter, exporter ou
          supprimer tes données (dont ton compte), écris à {contact} : la demande est traitée dans un délai d’un mois.
          Tu peux aussi adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </Section>
    </Screen>
  )
}
