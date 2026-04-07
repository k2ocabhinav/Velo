package com.velo.platform.services;

import org.locationtech.jts.geom.Point;

public interface DistanceService {
    /*
    * Using OSRM API for distance calculation
    */
    double calculateDistance(Point src, Point dest);

    double[] calculateDistanceAndDuration(Point src, Point dest);
}
