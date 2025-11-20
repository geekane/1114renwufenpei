import pandas as pd
import json
import re

def clean_value(value):
    """Clean and standardize string values."""
    if pd.isna(value):
        return None
    s_value = str(value).strip()
    if s_value in ["无", "暂无", "N/A", "/", "", " "]:
        return None
    return s_value

def generate_store_details_sql(excel_path):
    df = pd.read_excel(excel_path, sheet_name='Sheet1')
    
    # Filter out rows that are just notes or empty
    df = df.dropna(subset=['门店名称（区位名称）']).reset_index(drop=True)
    
    # Remove the PS row at the end if it exists
    if df['排序'].astype(str).str.contains('PS').any():
        df = df[~df['排序'].astype(str).str.contains('PS')]

    # Rename columns to match database schema, cleaning up potential whitespace
    df.columns = [col.strip() for col in df.columns]
    
    # Map original column names to database column names
    col_mapping = {
        '排序': 'sort_order',
        '门店名称（区位名称）': 'store_name',
        '所处区域': 'district',
        '建筑面积': 'building_area',
        '套内实际面积': 'usable_area',
        '租金': 'rent',
        '免租期': 'rent_free_period',
        '物业费': 'property_fee',
        '电费': 'electricity_fee',
        '水费': 'water_fee',
        '付款方式': 'payment_method',
        '租金递增方式': 'rent_increase',
        '合同年限': 'contract_years',
        '门店属性': 'properties',
        '开办杂费': 'startup_costs',
        '筹开进度': 'progress',
        '预估回本周期': 'roi_period'
    }
    df = df.rename(columns=col_mapping)

    # Generate store_id based on a cleaned version of store_name
    df['store_id'] = df['store_name'].apply(lambda x: re.sub(r'[^\w]', '', x).lower())

    # Replace NaN with None for SQL NULL values and handle special string values
    for col in df.columns:
        df[col] = df[col].apply(clean_value)

    # Ensure sort_order is integer
    df['sort_order'] = df['sort_order'].fillna(0).astype(int)

    sql_statements = []
    for index, row in df.iterrows():
        columns = []
        values = []
        for col, db_col in col_mapping.items():
            if db_col in row and row[db_col] is not None:
                columns.append(db_col)
                # Escape single quotes for SQL string literal
                value = str(row[db_col]).replace("'", "''")
                values.append(f"'{value}'")
            elif db_col == 'store_id': # Ensure store_id is always included
                columns.append('store_id')
                values.append(f"'{row['store_id']}'")
        
        # Manually add store_id if not already added by col_mapping
        if 'store_id' not in columns:
            columns.insert(0, 'store_id')
            values.insert(0, f"'{row['store_id']}'")


        sql = f"INSERT INTO store_details ({', '.join(columns)}) VALUES ({', '.join(values)});"
        sql_statements.append(sql)
    
    return "\n".join(sql_statements), df[['store_id', 'store_name']]

def generate_gantt_tasks_sql(excel_path, store_mapping):
    df = pd.read_excel(excel_path, sheet_name='Sheet1', header=None)
    
    sql_statements = []
    task_id_counter = {} # To ensure unique task IDs per store

    # Assuming the Excel columns are: Task Title, Assignee, Start Date, End Date
    for index, row in df.iterrows():
        title = clean_value(row[0])
        assignee = clean_value(row[1])
        start_date = clean_value(row[2])
        end_date = clean_value(row[3])

        if not title or not start_date or not end_date:
            continue # Skip rows with missing essential task info

        # For simplicity, assign tasks to a default store or derive from title if needed
        # Here, we'll assign to the first store in our mapping for demonstration
        # In a real scenario, you'd have a column for store_id in this excel or a more complex mapping
        store_id = store_mapping['store_id'].iloc[0] if not store_mapping.empty else 'default_store'
        
        if store_id not in task_id_counter:
            task_id_counter[store_id] = 0
        task_id_counter[store_id] += 1
        
        task_id = f"task-{store_id}-{task_id_counter[store_id]}"
        
        # Default values for progress and avatar
        progress = 0
        avatar = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/0.png' # Generic avatar

        # Format dates to YYYY-MM-DD
        try:
            start_date_str = pd.to_datetime(start_date).strftime('%Y-%m-%d')
            end_date_str = pd.to_datetime(end_date).strftime('%Y-%m-%d')
        except Exception:
            print(f"Warning: Could not parse date for task '{title}'. Skipping task.")
            continue

        escaped_title = title.replace("'", "''")
        sql = (f"""INSERT INTO gantt_tasks (id, store_id, title, start, end, progress, avatar) VALUES """ +
               f"""('{task_id}', '{store_id}', '{escaped_title}', '{start_date_str}', '{end_date_str}', {progress}, '{avatar}');""")
        sql_statements.append(sql)
    
    return "\n".join(sql_statements)

def generate_gantt_marklines_sql(store_mapping):
    sql_statements = []
    # Example marklines - you can add more logic to generate these based on data if available
    for index, row in store_mapping.iterrows():
        store_id = row['store_id']
        store_name = row['store_name']
        
        # Add a default milestone for each store
        sql_statements.append(f"INSERT INTO gantt_marklines (date, store_id, content, style, contentStyle) VALUES "
                              f"('2025-10-15', '{store_id}', '{store_name} - 阶段里程碑', '{{}}', '{{\"color\":\"#fff\"}}');")
    return "\n".join(sql_statements)


if __name__ == "__main__":
    store_details_excel = '筹开门店选址情况 (1).xlsx'
    task_tracking_excel = '新开门店进度追踪.xlsx'

    print("-- SQL Statements for D1 Database --\n")

    # Generate store_details SQL
    store_details_sql, store_mapping_df = generate_store_details_sql(store_details_excel)
    print("-- store_details INSERT statements --")
    print(store_details_sql)
    print("\n" + "="*50 + "\n")

    # Generate gantt_tasks SQL
    print("-- gantt_tasks INSERT statements (assuming all tasks for first store in mapping) --")
    # For tasks, we'll iterate through each store and generate tasks for it.
    # If the task tracking excel has no store_id, we can only assign them to a default one.
    # Let's assign tasks from '新开门店进度追踪.xlsx' to the first store from store_details for now.
    gantt_tasks_sql = ""
    if not store_mapping_df.empty:
        # Assuming all tasks from '新开门店进度追踪.xlsx' apply to all stores for now,
        # or we need a way to link tasks to specific stores in the excel itself.
        # For this example, let's duplicate tasks for each store in store_mapping_df.
        # This part might need adjustment if task excel has store-specific columns.
        all_tasks_df = pd.read_excel(task_tracking_excel, sheet_name='Sheet1', header=None)
        task_id_counter_global = 0
        for idx, store_row in store_mapping_df.iterrows():
            store_id = store_row['store_id']
            store_name = store_row['store_name']
            
            for task_idx, task_row in all_tasks_df.iterrows():
                title = clean_value(task_row[0])
                assignee = clean_value(task_row[1])
                start_date = clean_value(task_row[2])
                end_date = clean_value(task_row[3])

                if not title or not start_date or not end_date:
                    continue

                task_id_counter_global += 1
                task_id = f"task-{store_id}-{task_id_counter_global}"
                progress = 0
                avatar = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/0.png'

                try:
                    start_date_str = pd.to_datetime(start_date).strftime('%Y-%m-%d')
                    end_date_str = pd.to_datetime(end_date).strftime('%Y-%m-%d')
                except Exception:
                    print(f"Warning: Could not parse date for task '{title}' for store '{store_name}'. Skipping task.")
                    continue
                
                escaped_title = title.replace("'", "''")
                gantt_tasks_sql += (f"""INSERT INTO gantt_tasks (id, store_id, title, start, end, progress, avatar) VALUES """ +
                                    f"""('{task_id}', '{store_id}', '{escaped_title}', '{start_date_str}', '{end_date_str}', {progress}, '{avatar}');\n""")
    else:
        print("No stores found to generate tasks for.")
    
    print(gantt_tasks_sql)
    print("\n" + "="*50 + "\n")

    # Generate gantt_marklines SQL
    print("-- gantt_marklines INSERT statements --")
    gantt_marklines_sql = generate_gantt_marklines_sql(store_mapping_df)
    print(gantt_marklines_sql)
    print("\n" + "="*50 + "\n")