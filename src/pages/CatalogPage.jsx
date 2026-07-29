import { useNavigate, useSearchParams } from 'react-router-dom';
import RecipeCatalog from './RecipeCatalog.jsx';
import { usePlan } from '../hooks/usePlan.js';

// Wrapper: hubungkan RecipeCatalog ke PlanContext (setSlot) + navigasi.
export function CatalogPage() {
  const { setSlot } = usePlan();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRecipeId = searchParams.get('recipe');

  const handleAddToPlan = (recipe, day, mealType, servings) => {
    setSlot(recipe, day, mealType, servings);
  };

  return (
    <RecipeCatalog
      onAddToPlan={handleAddToPlan}
      onGoToPlanner={() => navigate('/planner')}
      initialRecipeId={initialRecipeId}
    />
  );
}

