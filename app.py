import pandas as pd
import json
from datetime import datetime
import os

def process_data():
    """Process the CSV data and create a JSON file for the dashboard"""
    # Read both CSV files
    csv_path1 = 'police_brutality_protests.csv'
    csv_path2 = 'police_brutality_protests_newsbank_prepped.csv'
    
    # Check if both files exist
    df1 = pd.read_csv(csv_path1, low_memory=False) if os.path.exists(csv_path1) else pd.DataFrame()
    df2 = pd.read_csv(csv_path2, low_memory=False) if os.path.exists(csv_path2) else pd.DataFrame()
    
    # Combine the dataframes
    if df1.empty and df2.empty:
        raise FileNotFoundError("No data files found")
    elif df1.empty:
        df = df2
    elif df2.empty:
        df = df1
    else:
        # Ensure both dataframes have the same columns before concatenating
        common_columns = list(set(df1.columns).intersection(set(df2.columns)))
        df = pd.concat([df1[common_columns], df2[common_columns]], ignore_index=True)
        
        # Remove duplicates if any
        df = df.drop_duplicates()
    
    # Convert date to datetime
    df['date'] = pd.to_datetime(df['date'])
    
    
    df['size_mean_imputed'] = df['size_mean'].fillna(11)
    
    # Create weekly protest counts
    df['week'] = df['date'].dt.strftime('%Y-%W')
    weekly_counts = df.groupby('week').agg(
        count=('date', 'size'),
        start_date=('date', 'min'),
        protester_count=('size_mean_imputed', 'sum')
    ).reset_index()
    weekly_counts['start_date'] = weekly_counts['start_date'].dt.strftime('%Y-%m-%d')
    
    # Create data for phased visualization
    df['month'] = df['date'].dt.strftime('%Y-%m')
    
    # Phase 1: Beginning until July 2014
    phase1_data = df[df['date'] <= '2014-07-31']
    phase1_monthly = phase1_data.groupby('month').agg(
        count=('date', 'size'),
        size=('size_mean_imputed', 'sum')
    ).reset_index()
    
    # Phase 2: August 2014 until December 2016
    phase2_data = df[(df['date'] > '2014-07-31') & (df['date'] <= '2016-12-31')]
    phase2_monthly = phase2_data.groupby('month').agg(
        count=('date', 'size'),
        size=('size_mean_imputed', 'sum')
    ).reset_index()
    
    # Phase 3: January 2017 until April 2020
    phase3_data = df[(df['date'] > '2016-12-31') & (df['date'] <= '2020-04-30')]
    phase3_monthly = phase3_data.groupby('month').agg(
        count=('date', 'size'),
        size=('size_mean_imputed', 'sum')
    ).reset_index()
    
    # Phase 4: Monthly counts May-October 2020 (Floyd protests)
    phase4_data = df[(df['date'] > '2020-04-30') & (df['date'] <= '2020-10-31')]
    phase4_monthly = phase4_data.groupby('month').agg(
        count=('date', 'size'),
        size=('size_mean_imputed', 'sum')
    ).reset_index()
    
    # Phase 5: Monthly counts since November 2020
    phase5_data = df[df['date'] > '2020-10-31'].copy()  # Create a proper copy
    phase5_monthly = phase5_data.groupby('month').agg(
        count=('date', 'size'),
        size=('size_mean_imputed', 'sum')
    ).reset_index()
    
    # Create a sample of the data for the table view
    # Select relevant columns
    table_data = df[['date', 'locality', 'state', 'type', 'claims', 'size_mean']].copy()
    
    # Format date
    table_data['date'] = table_data['date'].dt.strftime('%Y-%m-%d')
    
    # Handle missing values - impute unknown sizes with 11
    table_data['size_mean'] = table_data['size_mean'].fillna(11)
    
    # Convert to records
    table_records = table_data.head(1000).to_dict('records')
    
    # Calculate total protesters (imputing 11 for missing values)
    df['size_mean_imputed'] = df['size_mean'].fillna(11)
    total_protesters = int(df['size_mean_imputed'].sum())
    
    # Calculate daily protester counts
    daily_protester_counts = df.groupby('date').agg(
        count=('date', 'size'),
        protester_count=('size_mean_imputed', 'sum')
    ).reset_index()
    daily_protester_counts['date'] = daily_protester_counts['date'].dt.strftime('%Y-%m-%d')
    
    # Create the output data structure
    output_data = {
        'weekly_counts': weekly_counts.to_dict('records'),
        'daily_protester_counts': daily_protester_counts.to_dict('records'),
        'phase1_monthly': phase1_monthly.to_dict('records'),
        'phase2_monthly': phase2_monthly.to_dict('records'),
        'phase3_monthly': phase3_monthly.to_dict('records'),
        'phase4_monthly': phase4_monthly.to_dict('records'),
        'phase5_monthly': phase5_monthly.to_dict('records'),
        'table_data': table_records,
        'total_protests': len(df),
        'total_protesters': total_protesters,
        'date_range': {
            'start': df['date'].min().strftime('%Y-%m-%d'),
            'end': df['date'].max().strftime('%Y-%m-%d')
        },
        'top_states': df['state'].value_counts().head(5).to_dict(),
        'top_localities': df['locality'].value_counts().head(5).to_dict()
    }
    
    # Write to JSON file
    with open('static/data.json', 'w') as f:
        json.dump(output_data, f)
    
    print(f"Data processed successfully. {len(df)} protests analyzed.")
    return output_data

if __name__ == "__main__":
    # Create static directory if it doesn't exist
    os.makedirs('static', exist_ok=True)
    try:
        data = process_data()
        print(f"Date range: {data['date_range']['start']} to {data['date_range']['end']}")
    except Exception as e:
        print(f"Error processing data: {e}")
