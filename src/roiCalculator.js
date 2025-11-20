/**
 * 根据门店输入数据计算投资回报
 * @param {object} inputs - 包含计算所需输入值的对象
 * @param {number} [inputs.gross_area=0] - 门店面积 (含公摊 m²)
 * @param {number} [inputs.net_area=0] - 门店实用面积 (m²)
 * @param {number} [inputs.rent_per_sqm=0] - 门店房租 (元/每平)
 * @param {number} [inputs.prop_fee_per_sqm=0] - 物业费 (元/每平)
 * @param {number} [inputs.staff_count=0] - 工作人员数量
 * @param {number} [inputs.misc_startup_fee=0] - 其他杂项开办费
 * @returns {object} - 包含所有计算结果的对象
 */
export function calculateROI(inputs) {
    const results = {};
    try {
        const {
            gross_area = 0,
            net_area = 0,
            rent_per_sqm = 0,
            prop_fee_per_sqm = 0,
            staff_count = 0,
            misc_startup_fee = 0
        } = inputs;

        const floor_area_ratio = 3.5;
        const estimated_machines = net_area / floor_area_ratio;
        results.total_machines = estimated_machines;
        const booth_machines = estimated_machines / 10 * 4;
        const hall_machines = estimated_machines / 10 * 4;
        const private_room_machines = estimated_machines - booth_machines - hall_machines;

        const daily_retail_sales = results.total_machines * 5;
        const monthly_retail_sales = daily_retail_sales * 30;

        const avg_pc_hours = 14;
        const daily_revenue_private = avg_pc_hours * private_room_machines * 6;
        const daily_revenue_booth = avg_pc_hours * booth_machines * 4.5;
        const daily_revenue_hall = avg_pc_hours * hall_machines * 3.5;

        const daily_total_revenue = daily_revenue_private + daily_revenue_booth + daily_revenue_hall + daily_retail_sales;
        results.monthly_total_revenue = daily_total_revenue * 30;

        const rent_property_fee = (rent_per_sqm + prop_fee_per_sqm) * gross_area;
        const salaries = (25000 / 4) * staff_count;
        const retail_cost = monthly_retail_sales * 0.60;
        const water_electricity_fee = (results.total_machines * 0.4 * 0.9 * avg_pc_hours * 30) + (gross_area * 20);
        results.cloud_pc_fee = (private_room_machines * 320) + ((hall_machines + booth_machines) * 250);
        results.management_fee = results.monthly_total_revenue * 0.05;

        results.total_monthly_expenses = rent_property_fee + salaries + retail_cost + 4000 + 2500 + water_electricity_fee + 2000 + 3000 + results.cloud_pc_fee + results.management_fee;

        results.monthly_net_profit = results.monthly_total_revenue - results.total_monthly_expenses;

        results.decoration_cost = net_area * 1100;
        const ac_cost = net_area * 350;
        const furniture_cost = (850 + 500) * results.total_machines;
        const monitor_cost = (hall_machines + booth_machines) * 900 + private_room_machines * 1800;

        results.total_investment = results.decoration_cost + ac_cost + furniture_cost + monitor_cost + 30000 + 10000 + 5000 + 10000 + misc_startup_fee;

        results.payback_period = results.monthly_net_profit > 0 ? (results.total_investment / results.monthly_net_profit).toFixed(2) : '亏损或无利润';

        return results;

    } catch (e) {
        console.error("Calculation Error:", e);
        // 返回一个包含错误信息的对象，以便调用者可以优雅地处理
        return { error: e.message, payback_period: '计算错误' };
    }
}