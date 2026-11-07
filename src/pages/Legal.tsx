import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '@/lib/hooks';
import { BrandLink, Notice } from '@/components/ui';

/** Anything the operator must fill in is wrapped in <Fill> so it cannot be missed. */
const Fill = ({ children }: { children: ReactNode }) => <mark className="rounded bg-brass-300/50 px-1 font-semibold text-brass-700">[{children}]</mark>;
const H = ({ children }: { children: ReactNode }) => <h2 className="mt-8 text-xl font-semibold">{children}</h2>;
const P = ({ children }: { children: ReactNode }) => <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{children}</p>;
const L = ({ children }: { children: ReactNode }) => <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-soft">{children}</ul>;

function Shell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  useTitle(title);
  return (
    <div className="mx-auto max-w-2xl px-5 pb-20 pt-6">
      <BrandLink />
      <h1 className="mt-8 text-4xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">Draft · {updated}</p>
      <Notice tone="danger" className="mt-5" title="Draft — not yet legal advice or an adopted policy">
        This text describes what the software actually does today. Before launch it must be reviewed by a qualified lawyer for your jurisdiction (for example UK/EU GDPR, CCPA, online-safety law), and the highlighted <Fill>placeholders</Fill> completed.
      </Notice>
      {children}
      <p className="mt-10 flex gap-5 text-sm font-semibold text-plum-700"><Link to="/privacy" className="hover:underline">Privacy</Link><Link to="/terms" className="hover:underline">Terms</Link><Link to="/safety" className="hover:underline">Safety centre</Link><Link to="/" className="hover:underline">Home</Link></p>
    </div>
  );
}

export function Privacy() {
  return (
    <Shell title="Privacy policy" updated="describes software behaviour as built">
      <P>AMONGHER is run by <Fill>operator legal name and address</Fill>. We built it to collect as little as possible. This page explains what we hold, who can see it, and what you can do about it.</P>

      <H>What we collect</H>
      <L>
        <li><strong>To run your account:</strong> your email address and a password (the password is stored only as a hash by our authentication provider), your username, your avatar choice, and the time you confirmed you are 18 or older.</li>
        <li><strong>Optional profile details:</strong> bio, location, interests. You decide whether to add them and whether other members can see them.</li>
        <li><strong>What you create:</strong> posts, comments, reactions, saved items, people you follow or block, situations you choose to share, and your settings.</li>
        <li><strong>Messages:</strong> message requests and the conversations you accept.</li>
        <li><strong>Safety records:</strong> reports you file, moderation actions about your content or account, appeals, and verified-contributor requests (including any file you upload).</li>
      </L>
      <H>What we do not collect</H>
      <P>Your real name, phone number, photographs, contacts, precise location, or advertising identifiers. The app currently has no analytics or tracking scripts. <Fill>If you add analytics later, update this section.</Fill></P>

      <H>Who can see what</H>
      <L>
        <li><strong>Your email:</strong> only you, and people with access to our database console for support or legal reasons. It is never shown in the app, including to moderators and administrators.</li>
        <li><strong>Anonymous posts and comments:</strong> other members see no username or avatar. Moderators can see which account wrote an anonymous item so they can act on abuse reports. Administrators and moderators cannot see anonymous authorship in any other circumstance.</li>
        <li><strong>Private messages:</strong> only you and the other person. They are protected by access controls but are <strong>not end-to-end encrypted</strong>. Moderators see a conversation or message only if a participant reports it, and then only the messages the reporter attaches.</li>
        <li><strong>Discoverability:</strong> if you opt in to “Find someone who understands”, members see your username, avatar, short note and (if public) bio — not your email or location.</li>
        <li><strong>Verification files:</strong> stored in a private bucket; only you and administrators can open them.</li>
      </L>

      <H>Age</H>
      <P>AMONGHER is for adults. We ask you to confirm you are 18 or older; this is a self-declaration and we do not independently verify it. If you believe a child is using the service, use the report button or contact us.</P>

      <H>Where data is processed</H>
      <P>Data is hosted with Supabase (database, authentication, file storage) in <Fill>region chosen by operator</Fill>. Authentication emails are sent through <Fill>email provider</Fill>. <Fill>List any other processors.</Fill></P>

      <H>How long we keep it</H>
      <L>
        <li>Delete your account in Settings and your profile, posts, comments, reactions, saved items and settings are deleted.</li>
        <li>Messages you sent remain in the other person’s conversation, no longer linked to you.</li>
        <li>Reports you filed are kept without your identity; our moderation audit log is kept <Fill>retention period</Fill>.</li>
        <li>Backups are kept <Fill>backup retention period</Fill> and then overwritten.</li>
      </L>

      <H>Your choices and rights</H>
      <L>
        <li><strong>Access / portability:</strong> Settings → Your data → Download my data.</li>
        <li><strong>Correction:</strong> edit your profile and posts at any time.</li>
        <li><strong>Deletion:</strong> Settings → Delete my account.</li>
        <li><strong>Control:</strong> choose profile visibility, whether people can message you, and whether you are discoverable.</li>
        <li><strong>Complaints:</strong> contact <Fill>privacy contact email</Fill>, or your local data-protection authority.</li>
      </L>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of use" updated="describes software behaviour as built">
      <P>By creating an account you agree to these terms. They are written to be read, not skimmed past.</P>

      <H>Who can join</H>
      <P>AMONGHER is a space for women aged 18 and over. You confirm that you meet this when you join. Access is currently based on that declaration. We may remove accounts that we reasonably believe do not belong here.</P>

      <H>How to behave</H>
      <P>Follow the <Link to="/safety#guidelines" className="font-semibold text-plum-700 underline">Community Guidelines</Link>. In short: be kind, protect privacy, no harassment, threats, hate, spam, or solicitation, and handle heavy topics with care.</P>

      <H>Your content</H>
      <L>
        <li>You keep ownership of what you post. You give us permission to store and display it to other members as the service works (for example in feeds and search).</li>
        <li>Editors may feature your post in the Library <strong>only if you tick the consent box</strong>. You can withdraw that consent, or delete the post, at any time and it leaves the Library.</li>
        <li>Don’t post anything you don’t have the right to share, and don’t reveal other people’s identifying details.</li>
      </L>

      <H>Not professional advice</H>
      <P>Posts are personal experiences from members. They are not medical, legal, financial or other professional advice. In an emergency contact your local emergency services.</P>

      <H>Moderation, suspension and appeals</H>
      <P>Moderators can hide or remove content. Administrators can suspend accounts. If your account is suspended you will be told why and can appeal; an administrator reviews every appeal. We act on reports in good faith but cannot promise real-time responses.</P>

      <H>Ending your use</H>
      <P>You can delete your account at any time in Settings. We may suspend or end accounts that break these terms.</P>

      <H>Our responsibility</H>
      <P><Fill>Limitation of liability, warranty disclaimer, governing law and jurisdiction — to be written by counsel.</Fill></P>

      <H>Changes and contact</H>
      <P>If we change these terms in a way that matters, we will tell members in the app before it takes effect. Contact: <Fill>contact email</Fill>.</P>
    </Shell>
  );
}
