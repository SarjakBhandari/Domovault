import { Suspense } from 'react';
import BrowseClient from './BrowseClient';

export const metadata = {
  title: 'Browse Properties',
};

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseClient />
    </Suspense>
  );
}
