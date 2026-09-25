import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export interface GalleryPhoto {
  id: string;
  src: string;
  blurhash?: string | null;
}

/** Swipeable full-width photos with an "n of N" counter (announced, not colour-only dots). */
export function Gallery({ photos, alt }: { photos: GalleryPhoto[]; alt: string }) {
  const { t, f } = useUi();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = Math.round((width * 3) / 4);
  if (!photos.length)
    return (
      <View style={{ height }} className="items-center justify-center bg-brand-subtle">
        <Text tone="secondary">{t.noPhotos}</Text>
      </View>
    );
  return (
    <View style={{ height }} className="bg-brand-subtle">
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.id}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Image source={{ uri: item.src }} placeholder={item.blurhash ? { blurhash: item.blurhash } : undefined} contentFit="cover" transition={150} style={{ width, height }} alt={`${alt} — ${f('photoOf', { index: i + 1, total: photos.length })}`} />
        )}
      />
      {photos.length > 1 ? (
        <View className="absolute bottom-3 rounded-full bg-page/80 px-3 py-1" style={{ end: 12 }}>
          <Text variant="caption" accessibilityLiveRegion="polite">{f('photoOf', { index: index + 1, total: photos.length })}</Text>
        </View>
      ) : null}
    </View>
  );
}
