# Codebase Review: API and Supabase Service Layer
**Date**: 2026-06-27  
**Scope**: Services directory (`C:/Users/Zilfi Alvin/Desktop/PKM 2026/CookPlan PIMNAS/CookPlan/src/services/`)

---

## Executive Summary
This report analyzes 14 JavaScript files inside the service layer (`src/services/`) that handle Supabase database queries, storage buckets, and Edge Function operations. The primary goals were to review error handling, fallback behaviors, loading states, and API call efficiency.

Overall, the service layer is structured consistently with camelCase aliasing matching the frontend needs. However, the review identified several critical areas for improvement:
1. **Transaction Integrity Risks**: Multi-step operations like delete-then-insert and multi-table insertions are executed sequentially client-side without transaction blocks, creating risks of inconsistent or partial database states.
2. **API Efficiency & Round-trip Overhead**: Multiple database operations use sequential SELECTs or parallel HEAD requests which could be aggregated into single joined SELECT queries or database RPCs.
3. **Session Verification Bottlenecks**: A blocking call to `supabase.auth.getUser()` is performed in almost every service function. On pages triggering multiple service calls, this translates to multiple sequential REST round-trips to verify the JWT token, which can be optimized by passing cached user context.
4. **Code-Comment Inconsistencies & Silent Failures**: Certain functions lack proper logging when errors are caught, returning silent fallbacks, or mismatching comment documentation.

---

## Table of Findings

| File & Location | Issue Description | Severity | Recommended Fix | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **adminPackageService.js**<br>[L127-147](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/services/adminPackageService.js#L127-L147) | **Non-atomic Delete-then-Insert**: `setPackageMeals` deletes all previous package meals before inserting new ones. If the subsequent insert fails, the package is left with no meals. | **High** | Move this logic to a database RPC or transaction block.<br><br>```sql<br>create or replace function set_package_meals(p_package_id uuid, p_meals jsonb)<br>returns void language plpgsql security definer as $$<br>begin<br>  delete from package_meals where package_id = p_package_id;<br>  insert into package_meals (package_id, day_index, meal_type, recipe_id)<br>  select p_package_id, (m->>'dayIndex')::int, m->>'mealType', (m->>'recipeId')::int<br>  from jsonb_array_elements(p_meals) as m;<br>end;<br>$$;<br>``` | Ensures atomicity. Prevents corrupted data states if network drops or database constraints fail during the insert phase. |
| **orderService.js**<br>[L24-83](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/services/orderService.js#L24-L83) | **Triple Database Round-Trip**: Creating an order involves three sequential database requests: (1) insert into `orders`, (2) insert into `order_items`, and (3) select from `orders` again to get the trigger-calculated fresh totals. | **Medium** | Wrap the checkout process in a single PostgreSQL RPC `create_order_with_items` that returns the fresh order row directly. | Reduces checkout network latency by 66% and prevents orphaned order headers if item insertions fail. |
| **planService.js**<br>[L48-81](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/services/planService.js#L48-L81) | **Sequential Selects in Planner**: `getCurrentPlan` does a separate `weekly_plans` query followed by a `meal_entries` query, adding sequential latency on planner page load. | **Medium** | Combine both calls using PostgREST's relationship join syntax:<br><br>```javascript<br>let { data: planRow, error } = await supabase<br>  .from("weekly_plans")<br>  .select(`id, meal_entries (recipe_id, day_of_week, meal_type, servings, title, image_url, price_idr, ready_in_minutes, calories)`)<br>  .eq("user_id", user.id)<br>  .eq("week_start_date", weekStart)<br>  .maybeSingle();<br>``` | Cuts down the network requests by 50% during Weekly Planner initial page load. |
| **profileService.js**<br>[L43-85](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/services/profileService.js#L43-L85) | **Inefficient Nested Update**: `updateProfile` performs an update query, and then returns `getProfile()` which performs another session fetch and a select query. | **Medium** | Use the `.select()` modifier on the update query to return the updated record directly, bypassing `getProfile()`. | Bypasses two redundant network requests (1 token verification and 1 database select) on profile save. |
| **Global Issue**<br>Multiple Files | **getUser() Network Overhead**: In all authenticated operations, the service layer calls `await supabase.auth.getUser()`, which makes a blocking network token validation request. | **Medium** | Accept `currentUser` or `userId` as an optional parameter. If provided, skip the `getUser()` fetch. | Prevents redundant session token verification requests when the frontend `AuthContext` already has the active user. |
| **feedbackService.js**<br>[L68-77](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/services/feedbackService.js#L68-L77) | **Comment / Code Mismatch**: Comment says "Disertai email pelapor lewat join ke profiles bila tersedia", but the code only selects `user_id` without any join. | **Low** | Update the query to join the profile details or fix the comment:<br><br>```javascript<br>.select("id, rating, category, message, page, created_at, user_id, profiles (username, full_name)")<br>``` | Aligns documentation with implementation and prevents bugs in the admin feedback dashboard. |
| **adminService.js**<br>[L57-80](file:///C:/Users/Zilfi%20Alvin/Desktop/PKM%202026/CookPlan%20PIMNAS/CookPlan/src/services/adminService.js#L57-L80) | **Silent Failure on Stats Tally**: If any count query fails, it returns `0` silently without logging the error, hiding RLS or schema issues. | **Low** | Log the errors to `console.error` inside the `tally` catch/error block before returning `0`. | Improves observability and error tracing for admin operations. |

---

## Detailed Recommendations & Code Diffs

### 1. Atomic Operations in `adminPackageService.js`
Replacing sequential non-transactional database calls with RPC calls ensures data integrity.

```diff
-export async function setPackageMeals(packageId, meals) {
-  await requireUser();
-  const { error: delErr } = await supabase
-    .from("package_meals")
-    .delete()
-    .eq("package_id", packageId);
-  if (delErr) throw delErr;
-
-  const rows = (meals ?? [])
-    .filter((m) => m.recipeId)
-    .map((m) => ({
-      package_id: packageId,
-      day_index: m.dayIndex,
-      meal_type: m.mealType,
-      recipe_id: Number(m.recipeId),
-    }));
-  if (rows.length === 0) return;
-
-  const { error } = await supabase.from("package_meals").insert(rows);
-  if (error) throw error;
-}
+export async function setPackageMeals(packageId, meals) {
+  await requireUser();
+  const cleanMeals = (meals ?? [])
+    .filter((m) => m.recipeId)
+    .map((m) => ({
+      dayIndex: m.dayIndex,
+      mealType: m.mealType,
+      recipeId: Number(m.recipeId)
+    }));
+
+  const { error } = await supabase.rpc("set_package_meals", {
+    p_package_id: packageId,
+    p_meals: cleanMeals
+  });
+  if (error) throw error;
+}
```

### 2. Single-Query Fetch in `planService.js`
Optimize `getCurrentPlan` to fetch weekly plan details and meal entries in a single network round-trip.

```diff
 export async function getCurrentPlan(weekStart = getCurrentWeekStart()) {
   const { data: userData } = await supabase.auth.getUser();
   const user = userData?.user;
   if (!user) throw new Error("Belum login.");
 
-  // cari plan minggu ini
-  let { data: planRow, error } = await supabase
-    .from("weekly_plans")
-    .select("id")
-    .eq("user_id", user.id)
-    .eq("week_start_date", weekStart)
-    .maybeSingle();
-  if (error) throw error;
-
-  // belum ada → buat
-  if (!planRow) {
-    const { data: inserted, error: insErr } = await supabase
-      .from("weekly_plans")
-      .insert({ user_id: user.id, week_start_date: weekStart })
-      .select("id")
-      .single();
-    if (insErr) throw insErr;
-    planRow = inserted;
-  }
-
-  // ambil slot
-  const { data: entries, error: entErr } = await supabase
-    .from("meal_entries")
-    .select("recipe_id, day_of_week, meal_type, servings, title, image_url, price_idr, ready_in_minutes, calories")
-    .eq("plan_id", planRow.id);
-  if (entErr) throw entErr;
-
-  return { planId: planRow.id, plan: entriesToPlanShape(entries) };
+  let { data: planRow, error } = await supabase
+    .from("weekly_plans")
+    .select(`
+      id,
+      meal_entries (
+        recipe_id, day_of_week, meal_type, servings, title, image_url, price_idr, ready_in_minutes, calories
+      )
+    `)
+    .eq("user_id", user.id)
+    .eq("week_start_date", weekStart)
+    .maybeSingle();
+  if (error) throw error;
+
+  if (!planRow) {
+    const { data: inserted, error: insErr } = await supabase
+      .from("weekly_plans")
+      .insert({ user_id: user.id, week_start_date: weekStart })
+      .select("id")
+      .single();
+    if (insErr) throw insErr;
+    return { planId: inserted.id, plan: createEmptyPlan() };
+  }
+
+  return { planId: planRow.id, plan: entriesToPlanShape(planRow.meal_entries) };
 }
```

### 3. Direct Returning Update in `profileService.js`
Update the `profiles` table and return the result in one step.

```diff
 export async function updateProfile(patch = {}) {
   const { data: userData } = await supabase.auth.getUser();
   const user = userData?.user;
   if (!user) throw new Error("Belum login.");
 
   const updates = {};
   // ... field validation code ...
 
-  if (Object.keys(updates).length === 0) return getProfile();
+  if (Object.keys(updates).length === 0) return getProfile(user);
 
-  const { error } = await supabase
+  const { data, error } = await supabase
     .from("profiles")
     .update(updates)
-    .eq("id", user.id);
+    .eq("id", user.id)
+    .select(PROFILE_SELECT)
+    .single();
   if (error) throw error;
 
-  return getProfile();
+  return {
+    id: data.id,
+    email: user.email ?? "",
+    fullName: data.full_name || "",
+    username: data.username || "",
+    gender: data.gender || "",
+    avatarUrl: data.avatar_url || "",
+    createdAt: data.created_at ?? user.created_at ?? null,
+    dietPrefs: data.diet_prefs ?? [],
+    persona: data.persona || "",
+  };
 }
```

---

## Conclusion
Refactoring these service endpoints will dramatically optimize user loading speeds and ensure database consistency across plan creation, checkout operations, and profile updates. Transitioning from client-side sequential writes to SQL RPC wrappers is highly recommended for all data-modification flows.
