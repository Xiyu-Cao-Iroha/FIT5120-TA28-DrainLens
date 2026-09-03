#load required libraries
library(tidyverse)
library(janitor)
library(dplyr)
library(scales)
library(geosphere)
library(jsonlite)
library(leaflet)
library(car)
library(sf)
library(spatstat)
library(nortest)

# Read dataset
drainpipe <- read_csv("Drainpipes.csv")

head(drainpipe)

drainpipe <- clean_names(drainpipe)

#verify column names
names(drainpipe)


drainpipe <- drainpipe %>% distinct()
dim(drainpipe)
##-> no duplicates

#check missing values
colSums(is.na(drainpipe))

#Removing Columns with no derived meaning or one dominant value and no meaningful variation
drainpipe <- drainpipe %>%
  select(
    -id,
    -form,
    -carrying
  )

head(drainpipe,20)

summary(drainpipe$upstr_inv)
summary(drainpipe$dnstr_inv)


# Split geo_point_2d into usable lat/lon columns 
drainpipe <- drainpipe %>%
  separate(geo_point_2d, into = c("lat", "lon"), sep = ",\\s*", remove = FALSE) %>%
  mutate(lat = as.numeric(lat), lon = as.numeric(lon))

#Assess the quality of connectivity
drainpipe <- drainpipe %>%
  mutate(
    connection_status = case_when(
      !is.na(upstr_pit) & !is.na(dnstr_pit) ~ "Both connections recorded",
      !is.na(upstr_pit) & is.na(dnstr_pit) ~ "Downstream missing",
      is.na(upstr_pit) & !is.na(dnstr_pit) ~ "Upstream missing",
      TRUE ~ "Both connections missing"
    )
  )

drainpipe %>%
  count(connection_status) %>%
  mutate(pct = percent(n / sum(n)))

summary(drainpipe$diameter)

# Treat diameter = 0 as missing, not a real pipe size 
sum(drainpipe$diameter == 0, na.rm = TRUE)
drainpipe <- drainpipe %>%
  mutate(diameter = na_if(diameter, 0))


# Derive pipe length from geo_shape geometry 
get_pipe_length_m <- function(geo_shape_str) {
  tryCatch({
    parsed <- fromJSON(geo_shape_str)
    coords <- parsed$coordinates
    if (is.list(coords)) coords <- coords[[1]]  
    if (is.null(dim(coords)) || nrow(coords) < 2) return(NA_real_)
    
    # sum consecutive great-circle distances along the line (lon, lat order)
    sum(distGeo(coords[-nrow(coords), , drop = FALSE], coords[-1, , drop = FALSE]))
  }, error = function(e) NA_real_)
}


drainpipe <- drainpipe %>%
  mutate(pipe_length_m = map_dbl(geo_shape, get_pipe_length_m))

summary(drainpipe$pipe_length_m)



## Statistical Analysis 

# Derive pipe age 
drainpipe <- drainpipe %>%
  mutate(pipe_age_yr = as.numeric(format(Sys.Date(), "%Y")) - as.numeric(format(built, "%Y")))

# derive descriptive statistics for numeric values
drainpipe %>%
  summarise(
    n_pipes  = n(),
    mean_diameter_mm = mean(diameter, na.rm = TRUE),
    sd_diameter_mm  = sd(diameter,   na.rm = TRUE),
    mean_length_m = mean(pipe_length_m, na.rm = TRUE),
    sd_length_m  = sd(pipe_length_m,   na.rm = TRUE),
    mean_condition = mean(condition, na.rm = TRUE),
    sd_condition = sd(condition,   na.rm = TRUE),
    mean_age_yr = mean(pipe_age_yr, na.rm = TRUE),
    pct_missing_diam = mean(is.na(diameter)) * 100,
    pct_missing_cond = mean(is.na(condition)) * 100
  )
drainpipe %>% count(material, sort = TRUE) 


## Exploratory Data Analysis

# check if condition of pipe differ by material.
condition_by_material <- drainpipe %>%
  group_by(material) %>%
  summarise(
    n = n(),
    mean_condition = mean(condition, na.rm = TRUE)
  )

condition_by_material %>%
  pivot_longer(
    cols = c(mean_condition),
    names_to = "statistic",
    values_to = "condition"
  ) %>%
  ggplot(aes(x = material, y = condition)) +
  geom_col(
    position = position_dodge(width = 0.8),
    width = 0.7
  ) +
  labs(
    title = "Mean drainpipe condition by material",
    x = "Material",
    y = "Condition"
  ) +
  theme_minimal() +
  theme(
    axis.text.x = element_text(angle = 45, hjust = 1)
  )

# View Material composition of pipes and its relative percentage
drainpipe %>%
  count(material, sort = TRUE) %>%
  mutate(pct = percent(n / sum(n), accuracy = 0.1))


drainpipe %>%
  group_by(material) %>%
  summarise(
    n = n(),
    pct_with_mat_desc = percent(mean(!is.na(mat_desc)), accuracy = 0.1)
  ) %>%
  arrange(desc(n))

# Diameter of drainpipe  by material 
drainpipe %>%
  filter(!is.na(diameter)) %>%
  group_by(material) %>%
  summarise(n = n(), mean_diameter = mean(diameter)) %>%
  arrange(desc(n))


# Spatial footprint of the network 
drainpipe %>%
  filter(!is.na(lat), !is.na(lon)) %>%
  ggplot(aes(x = lon, y = lat)) +
  geom_point(alpha = 0.1, size = 0.5, color = "royalblue") +
  coord_fixed(ratio = 1.3) +
  labs(title = "Spatial Footprint of drainpipe network",
       x = "Longitude", y = "Latitude") +
  theme_minimal()

#view the Network connectivity of the drainpipes 
drainpipe %>%
  summarise(
    pct_missing_upstream = percent(mean(is.na(upstr_pit)), accuracy = 0.1),
    pct_missing_downstream = percent(mean(is.na(dnstr_pit)), accuracy = 0.1),
    pct_missing_both = percent(mean(is.na(upstr_pit) & is.na(dnstr_pit)), accuracy = 0.1)
  )


drainpipe_pts <- drainpipe %>%
  filter(!is.na(lat), !is.na(lon))

leaflet(drainpipe_pts) %>%
  addProviderTiles(providers$CartoDB.Positron) %>%
  addCircleMarkers(
    lng = ~lon, lat = ~lat,
    radius = 2,
    stroke = FALSE,
    fillColor = "royalblue",
    fillOpacity = 0.35
  ) %>%
  addScaleBar(position = "bottomleft") %>%
  setView(lng = mean(drainpipe_pts$lon, na.rm = TRUE),
          lat = mean(drainpipe_pts$lat, na.rm = TRUE),
          zoom = 12)


write_csv(drainpipe, "DrainPipe_Cleaned.csv")

