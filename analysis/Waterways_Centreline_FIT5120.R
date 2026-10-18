
#load required libraries
library(tidyverse)
library(lubridate)
library(janitor)
library(readr)
library(readxl)
library(dplyr)
library(scales)


# Read datasets
centreline_raw <- read_excel("Centreline_of_the_Waterway.xlsx")

head(centreline_raw)

# standardise column names
centreline <- clean_names(centreline_raw)

#verify column names
names(centreline)


centreline <- centreline %>% distinct()
dim(centreline)
## -> no duplicate values

#check missing values
colSums(is.na(centreline))

#convert empty strings to NA
centreline <- centreline %>%
  mutate(
    across(
      where(is.character),
      ~ na_if(str_squish(.x), "")
    )
  )
centreline <- centreline %>%
  mutate(
    across(
      where(is.character),
      str_squish
    ),
    across(
      where(is.character),
      ~ na_if(.x, "")
    )
  )

centreline %>%
  summarise(
    across(
      where(is.character),
      ~ n_distinct(.x, na.rm = TRUE)
    )
  )

# since versions 2 and 3 of municipal code are removed, renaming column 'municipal_code_1'
centreline <- centreline %>% 
  rename(municipal_code = municipal_code_1)

#checking the number of non-zero values in column 'channel_width'
sum(centreline$channel_width == 0, na.rm = TRUE)
sum(centreline$channel_width != 0, na.rm = TRUE)

#inspecting material types
material_check <- centreline %>%
  count(material, sort = TRUE)

material_check

#service status and asset owner are constant values, so removing them
centreline <- centreline %>%
  select(
    -service_status,
    -asset_owner
  )

#converting drainage category into interpretable names
centreline <- centreline %>%
  mutate(
    drainage_category_desc = case_when(
      drainage_category == "T" ~ "Tributary",
      drainage_category == "M" ~ "Main",
      TRUE ~ "Unknown"
    )
  )

# validating the alues of column 'length'
centreline %>%
  summarise(
    n = n(),
    missing_length = sum(is.na(length)),
    zero_length = sum(length == 0, na.rm = TRUE),
    negative_length = sum(length < 0, na.rm = TRUE),
    min_length = min(length, na.rm = TRUE),
    max_length = max(length, na.rm = TRUE)
  )

#converting length to km for ease of interpretation
centreline <- centreline %>%
  mutate(
    length_km = length / 1000
  )

#inspecting municipal code values
centreline %>%
  count(municipal_code, sort = TRUE)

#clean subarea column
centreline <- centreline %>%
  mutate(
    subarea = str_to_upper(str_squish(subarea))
  )

centreline %>%
  count(subarea, sort = TRUE)

#cleaning sub catchment numbers
centreline <- centreline %>%
  mutate(
    sub_catchment_nbr = str_squish(sub_catchment_nbr),
    sub_catchment_nbr = na_if(sub_catchment_nbr, "")
  )

centreline %>%
  summarise(
    n = n(),
    missing = sum(is.na(sub_catchment_nbr)),
    unique = n_distinct(sub_catchment_nbr, na.rm = TRUE)
  )

#identifying repeated waterway names
waterway_summary <- centreline %>%
  group_by(asset_name) %>%
  summarise(
    n_segments = n(),
    total_length_km = sum(length_km, na.rm = TRUE),
    mean_segment_length_m = mean(length, na.rm = TRUE),
    max_stream_order = max(stream_order, na.rm = TRUE),
    n_materials = n_distinct(material),
    n_subcatchments = n_distinct(sub_catchment_nbr, na.rm = TRUE),
    n_municipalities = n_distinct(municipal_code),
    .groups = "drop"
  ) %>%
  arrange(desc(total_length_km))

waterway_summary

centreline <- centreline %>%
  select(
    -parallel_line_nbr,
    -municipal_code_2,
    -municipal_code_3,
    -date_of_construction,
    -asconst_plan_no,
    -service_status_chg_date,
    -service_status_plan_no,
    -comments
  )

write_csv(centreline, "Centreline_Cleaned.csv")
