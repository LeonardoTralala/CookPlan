import { useNavigate } from 'react-router-dom';
import WeeklyPlanner from './WeeklyPlanner.jsx';
import { usePlan } from '../hooks/usePlan.js';

// Wrapper: hubungkan WeeklyPlanner ke PlanContext + navigasi.
export function PlannerPage() {
  const { 
    weeklyPlan, setSlot, removeSlot, toggleCookedStatus, 
    prepTasks, addPrepTask, togglePrepTask, deletePrepTask 
  } = usePlan();
  const navigate = useNavigate();

  return (
    <WeeklyPlanner
      weeklyPlan={weeklyPlan}
      onSetSlot={setSlot}
      onRemoveSlot={removeSlot}
      onToggleCookedStatus={toggleCookedStatus}
      prepTasks={prepTasks}
      onAddPrepTask={addPrepTask}
      onTogglePrepTask={togglePrepTask}
      onDeletePrepTask={deletePrepTask}
      onGoToCatalog={() => navigate('/catalog')}
      onGoToGenerate={() => navigate('/generate')}
      onGenerateShoppingList={() => navigate('/shopping')}
    />
  );
}
