import { Button, EmptyState } from '@agarha/ui-native';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';

export default function NotFound() {
  const t = useTranslations('app.notFound');
  const router = useRouter();
  return (
    <Screen>
      <EmptyState title={t('title')} body={t('body')} action={<Button onPress={() => router.replace('/')}>{t('home')}</Button>} />
    </Screen>
  );
}
