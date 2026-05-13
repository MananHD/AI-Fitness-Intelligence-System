"""Weekly 7-day meal plan generator."""
from __future__ import annotations
from dataclasses import dataclass, asdict
from recommendation.diet_planner import DietPlanner, _calorie_target, _macro_targets

DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

# Per-day meal variation data keyed by (bmi_cat, pref, day_idx)
# Format: {meal_slot: (name, [items], calories)}
_VARIATIONS: dict[str, list[dict]] = {
    "veg_breakfast": [
        {"name":"Oatmeal Bowl","items":["Rolled oats with banana","Flaxseeds","Green tea"],"approx_calories":400},
        {"name":"Veggie Upma","items":["Semolina upma with peas","Coconut chutney","Herbal tea"],"approx_calories":380},
        {"name":"Paneer Paratha","items":["2 paneer parathas","Low-fat curd","Mint chutney"],"approx_calories":420},
        {"name":"Smoothie Bowl","items":["Banana-spinach smoothie","Chia seeds","Granola"],"approx_calories":390},
        {"name":"Poha","items":["Flattened rice with veggies","Peanuts","Lemon","Green tea"],"approx_calories":370},
        {"name":"Idli Sambar","items":["3 idlis","Sambar","Coconut chutney"],"approx_calories":360},
        {"name":"Besan Cheela","items":["2 gram-flour pancakes","Green chutney","1 glass milk"],"approx_calories":400},
    ],
    "veg_lunch": [
        {"name":"Dal Rice Bowl","items":["1 cup dal","1 cup brown rice","Sabzi","Raita"],"approx_calories":600},
        {"name":"Rajma Wrap","items":["2 whole-wheat wraps","Rajma filling","Salad"],"approx_calories":580},
        {"name":"Chole Plate","items":["Chole","2 chapatis","Onion salad","Lassi"],"approx_calories":620},
        {"name":"Mixed Veg Thali","items":["Paneer curry","Dal","Rice","Salad","Buttermilk"],"approx_calories":640},
        {"name":"Lentil Soup Meal","items":["2 cups lentil soup","Brown rice","Stir-fried veggies"],"approx_calories":560},
        {"name":"Tofu Stir Fry","items":["Tofu stir-fry","Quinoa","Steamed broccoli"],"approx_calories":580},
        {"name":"Palak Paneer","items":["Palak paneer","2 chapatis","Cucumber raita"],"approx_calories":600},
    ],
    "veg_dinner": [
        {"name":"Light Dal Soup","items":["Moong dal soup","1 chapati","Salad"],"approx_calories":420},
        {"name":"Grilled Paneer","items":["100g grilled paneer","Stir-fried veggies","1 chapati"],"approx_calories":450},
        {"name":"Veg Khichdi","items":["Dal-rice khichdi","Low-fat curd","Salad"],"approx_calories":400},
        {"name":"Chickpea Curry","items":["Chickpea curry","1 chapati","Green salad"],"approx_calories":430},
        {"name":"Vegetable Soup","items":["Clear veg soup","2 veg cutlets","Salad"],"approx_calories":380},
        {"name":"Stuffed Capsicum","items":["2 stuffed bell peppers","1 chapati","Raita"],"approx_calories":420},
        {"name":"Mushroom Sabzi","items":["Mushroom masala","2 chapatis","Dal"],"approx_calories":440},
    ],
    "nonveg_breakfast": [
        {"name":"Egg Scramble","items":["3 scrambled eggs","2 toast","1 glass milk"],"approx_calories":480},
        {"name":"Omelette","items":["2-egg omelette with veg","1 toast","Orange juice"],"approx_calories":450},
        {"name":"Boiled Eggs","items":["3 boiled eggs","1 banana","Green tea"],"approx_calories":400},
        {"name":"Egg Paratha","items":["Egg paratha (2)","Curd","Mint chutney"],"approx_calories":480},
        {"name":"Chicken Sandwich","items":["Grilled chicken sandwich","1 apple","Green tea"],"approx_calories":470},
        {"name":"Egg Poha","items":["Egg poha","Peanuts","Lemon water"],"approx_calories":430},
        {"name":"Egg Bhurji","items":["Egg bhurji (3 eggs)","2 toast","Low-fat milk"],"approx_calories":460},
    ],
    "nonveg_lunch": [
        {"name":"Chicken Rice Bowl","items":["150g grilled chicken","Brown rice","Salad"],"approx_calories":620},
        {"name":"Fish Curry","items":["Fish curry (150g)","2 chapatis","Dal","Salad"],"approx_calories":640},
        {"name":"Chicken Wrap","items":["2 chicken wraps","Coleslaw","Lemon water"],"approx_calories":600},
        {"name":"Egg Fried Rice","items":["Egg fried rice (2 eggs)","Veg stir-fry","Soup"],"approx_calories":580},
        {"name":"Grilled Fish Plate","items":["150g grilled fish","Quinoa","Steamed veg"],"approx_calories":580},
        {"name":"Chicken Curry","items":["Chicken curry (150g)","2 chapatis","Raita"],"approx_calories":650},
        {"name":"Prawn Stir-Fry","items":["Prawn stir-fry","Brown rice","Salad"],"approx_calories":600},
    ],
    "nonveg_dinner": [
        {"name":"Baked Fish","items":["120g baked fish","Steamed veg","1 chapati"],"approx_calories":480},
        {"name":"Chicken Soup","items":["Chicken soup","1 chapati","Salad"],"approx_calories":420},
        {"name":"Grilled Chicken","items":["100g grilled chicken","Roasted veggies"],"approx_calories":400},
        {"name":"Fish Tikka","items":["Fish tikka (100g)","1 chapati","Salad"],"approx_calories":440},
        {"name":"Egg Curry","items":["Egg curry (2 eggs)","1 chapati","Dal"],"approx_calories":450},
        {"name":"Chicken Salad","items":["Shredded chicken salad","Olive oil dressing"],"approx_calories":380},
        {"name":"Tandoori Fish","items":["Tandoori fish (120g)","Mint chutney","Salad"],"approx_calories":420},
    ],
    "vegan_breakfast": [
        {"name":"Overnight Oats","items":["Oats+chia+almond milk","Berries","Green tea"],"approx_calories":400},
        {"name":"Avocado Toast","items":["2 slices avocado toast","Mixed seeds","Lemon water"],"approx_calories":420},
        {"name":"Smoothie Bowl","items":["Mango-banana smoothie","Granola","Chia seeds"],"approx_calories":380},
        {"name":"Peanut Butter Toast","items":["2 toast+peanut butter","1 banana","Oat milk"],"approx_calories":450},
        {"name":"Tofu Scramble","items":["Tofu scramble with veg","1 toast","Herbal tea"],"approx_calories":380},
        {"name":"Fruit Bowl","items":["Mixed fruit bowl","Almond butter","Oat milk"],"approx_calories":360},
        {"name":"Vegan Pancakes","items":["2 banana-oat pancakes","Maple syrup","Berries"],"approx_calories":420},
    ],
    "vegan_lunch": [
        {"name":"Chickpea Salad","items":["Chickpea bowl","Quinoa","Lemon-tahini dressing"],"approx_calories":580},
        {"name":"Tofu Stir Fry","items":["Tofu stir-fry","Brown rice","Steamed broccoli"],"approx_calories":600},
        {"name":"Lentil Dal","items":["Red lentil dal","Brown rice","Roasted veggies"],"approx_calories":560},
        {"name":"Buddha Bowl","items":["Sweet potato","Chickpeas","Kale","Tahini"],"approx_calories":580},
        {"name":"Black Bean Wrap","items":["2 black bean wraps","Avocado","Salsa"],"approx_calories":560},
        {"name":"Tempeh Rice","items":["Tempeh stir-fry","Brown rice","Stir-fried veg"],"approx_calories":600},
        {"name":"Vegan Thali","items":["Chana masala","Brown rice","Salad","Hummus"],"approx_calories":580},
    ],
    "vegan_dinner": [
        {"name":"Lentil Soup","items":["Lentil soup","1 whole-grain bread","Salad"],"approx_calories":400},
        {"name":"Veg Stew","items":["Mixed veg stew","Quinoa","Green salad"],"approx_calories":380},
        {"name":"Tofu Curry","items":["Tofu curry","1 chapati","Salad"],"approx_calories":420},
        {"name":"Mushroom Soup","items":["Cream of mushroom soup (vegan)","Bread","Salad"],"approx_calories":360},
        {"name":"Stuffed Peppers","items":["Quinoa-stuffed peppers","Green salad"],"approx_calories":380},
        {"name":"Chickpea Soup","items":["Chickpea tomato soup","1 pita","Salad"],"approx_calories":400},
        {"name":"Roasted Veggies","items":["Roasted sweet potato+broccoli","Lentil soup"],"approx_calories":350},
    ],
}

_SNACKS = {
    "veg":     [{"name":"Mixed Nuts","items":["10 almonds","1 apple"],"approx_calories":180},
                {"name":"Yoghurt","items":["Low-fat curd","Honey"],"approx_calories":150},
                {"name":"Fruit","items":["1 banana","5 walnuts"],"approx_calories":170},
                {"name":"Hummus","items":["Hummus","Carrot sticks"],"approx_calories":160},
                {"name":"Makhana","items":["Roasted fox nuts (30g)","Green tea"],"approx_calories":110},
                {"name":"Cheese","items":["1 cheese slice","2 crackers"],"approx_calories":140},
                {"name":"Trail Mix","items":["Mixed nuts and raisins"],"approx_calories":200}],
    "non-veg": [{"name":"Boiled Egg","items":["1 boiled egg","5 almonds"],"approx_calories":120},
                {"name":"Chicken Strips","items":["50g grilled chicken strips"],"approx_calories":100},
                {"name":"Greek Yoghurt","items":["Low-fat Greek yoghurt (plain)"],"approx_calories":100},
                {"name":"Egg Whites","items":["2 boiled egg whites","1 apple"],"approx_calories":130},
                {"name":"Tuna Crackers","items":["Tuna on 2 crackers"],"approx_calories":120},
                {"name":"Nuts","items":["Mixed nuts (20g)"],"approx_calories":130},
                {"name":"Protein Shake","items":["Whey protein shake (half scoop)"],"approx_calories":80}],
    "vegan":   [{"name":"Hummus Sticks","items":["Hummus","Celery sticks"],"approx_calories":100},
                {"name":"Fruit","items":["1 orange","10 cashews"],"approx_calories":170},
                {"name":"Almond Milk","items":["Almond milk smoothie","Chia seeds"],"approx_calories":150},
                {"name":"Rice Cakes","items":["Rice cakes","Almond butter"],"approx_calories":180},
                {"name":"Dates","items":["3 dates","10 almonds"],"approx_calories":160},
                {"name":"Edamame","items":["Steamed edamame (50g)"],"approx_calories":80},
                {"name":"Trail Mix","items":["Nuts+dried fruit mix (30g)"],"approx_calories":170}],
}

from dataclasses import dataclass, field, asdict
from recommendation.diet_planner import Meal, DailyMealPlan


@dataclass
class WeeklyMealPlan:
    days: dict  # day_name -> DailyMealPlan dict
    avg_daily_calories: int
    protein_target_g: int
    water_litres: float
    weekly_notes: list[str]

    def to_dict(self) -> dict:
        return {
            "days": {d: p.to_dict() for d, p in self.days.items()},
            "avg_daily_calories": self.avg_daily_calories,
            "protein_target_g": self.protein_target_g,
            "water_litres": self.water_litres,
            "weekly_notes": self.weekly_notes,
        }


def generate_weekly_plan(
    bmi_category: str,
    sport: str,
    sport_intensity: str,
    dietary_preference: str,
    weight_kg: float,
    height_cm: float = 170,
    age: int = 25,
    gender: str = "male",
) -> WeeklyMealPlan:
    pref = dietary_preference.lower()
    pref_key = "non-veg" if pref == "non-veg" else pref.replace("-","")
    if pref == "non-veg":
        bkey = "nonveg"
    elif pref == "vegan":
        bkey = "vegan"
    else:
        bkey = "veg"

    snack_list = _SNACKS.get(pref, _SNACKS["veg"])
    cal, bmr, sport_category, multiplier = _calorie_target(
        bmi_category,
        sport,
        weight_kg,
        height_cm,
        age,
        gender,
    )
    prot, carbs, fats = _macro_targets(cal, weight_kg, sport_category)
    water = round(weight_kg * 0.033, 1)

    day_cal = cal

    days: dict[str, DailyMealPlan] = {}
    for i, day in enumerate(DAYS):
        b = _VARIATIONS[f"{bkey}_breakfast"][i]
        l = _VARIATIONS[f"{bkey}_lunch"][i]
        d = _VARIATIONS[f"{bkey}_dinner"][i]
        ms = snack_list[i % len(snack_list)]
        es = snack_list[(i + 1) % len(snack_list)]
        days[day] = DailyMealPlan(
            breakfast=Meal(**b),
            mid_morning_snack=Meal(**ms),
            lunch=Meal(**l),
            evening_snack=Meal(**es),
            dinner=Meal(**d),
            total_calories=day_cal,
            bmr=bmr,
            sport_category=sport_category,
            activity_multiplier=multiplier,
            protein_target_g=prot,
            carbs_target_g=carbs,
            fats_target_g=fats,
            water_litres=water,
            notes=[f"{day}: Focus on {sport}. Stay hydrated."],
        )

    notes = [
        f"7-day plan for {bmi_category} individual practising {sport} ({sport_intensity}).",
        f"Target: ~{day_cal} kcal/day · {prot}g protein · {water}L water.",
        "Rotate meals each week to maintain variety.",
        "Avoid processed food and refined sugar throughout the week.",
    ]
    if bmi_category == "Obese":
        notes.append("Consult a dietitian before starting this plan.")
    if pref == "vegan":
        notes.append("Supplement B12, Vitamin D, and Omega-3 (algae-based) daily.")

    return WeeklyMealPlan(days=days, avg_daily_calories=day_cal,
                          protein_target_g=prot, water_litres=water, weekly_notes=notes)
