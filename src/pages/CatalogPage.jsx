import { useNavigate, useSearchParams } from 'react-router-dom';
import RecipeCatalog from './RecipeCatalog.jsx';
import { usePlan } from '../hooks/usePlan.js';
import { SEOHead } from '../components/SEOHead.jsx';

// Wrapper: hubungkan RecipeCatalog ke PlanContext (setSlot) + navigasi + SEO metadata.
export function CatalogPage() {
  const { setSlot } = usePlan();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRecipeId = searchParams.get('recipe');

  const handleAddToPlan = (recipe, day, mealType, servings) => {
    setSlot(recipe, day, mealType, servings);
  };

  const catalogSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Katalog Resep & Inspirasi Menu Masak | CookPlan',
    description: 'Jelajahi berbagai resep masakan Nusantara dan inspirasi menu harian dari CookPlan dengan estimasi biaya porsi dan bahan-bahan lokal.',
    url: 'https://cookplan.id/catalog',
    isPartOf: {
      '@type': 'WebSite',
      name: 'CookPlan',
      url: 'https://cookplan.id/',
    },
  };

  return (
    <>
      <SEOHead
        title="Katalog Resep & Inspirasi Menu Masak Harian | CookPlan"
        description="Jelajahi ratusan resep masakan Nusantara dan inspirasi menu harian dari CookPlan. Lengkap dengan estimasi biaya per porsi dan bahan-bahan lokal hemat."
        canonicalUrl="https://cookplan.id/catalog"
        jsonLd={catalogSchema}
      />
      <RecipeCatalog
        onAddToPlan={handleAddToPlan}
        onGoToPlanner={() => navigate('/planner')}
        initialRecipeId={initialRecipeId}
      />
    </>
  );
}
