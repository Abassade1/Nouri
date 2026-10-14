import type { IconName } from '../ui';
import { EmptyState, Reveal, Screen, ScreenTitle } from '../ui';

/** Phase 1 stand-in for screens that arrive in later phases. */
export function PlaceholderTab({ title, icon, emptyTitle, emptyBody }: { title: string; icon: IconName; emptyTitle: string; emptyBody: string }) {
  return (
    <Screen edges={['top']}>
      <ScreenTitle title={title} />
      <Reveal delay={100}>
        <EmptyState icon={icon} title={emptyTitle} body={emptyBody} />
      </Reveal>
    </Screen>
  );
}
