import { useState, useEffect } from "react";
import { getProductTypes, getProductSubtypes } from "../api";

/**
 * Hook to load product types and subtypes from master CSV.
 * When selectedType changes, subtypes are refetched for that type.
 * Returns: { types, subtypes, loadingTypes, loadingSubtypes }
 */
export function useProductMaster(selectedType)
{
    const [types,           setTypes]           = useState([]);
    const [subtypes,        setSubtypes]        = useState([]);
    const [loadingTypes,    setLoadingTypes]    = useState(true);
    const [loadingSubtypes, setLoadingSubtypes] = useState(false);

    // Load types once
    useEffect(() =>
    {
        setLoadingTypes(true);
        getProductTypes()
            .then(data => setTypes(data))
            .catch(() => setTypes([]))
            .finally(() => setLoadingTypes(false));
    }, []);

    // Load subtypes when type changes
    useEffect(() =>
    {
        if (!selectedType) { setSubtypes([]); return; }
        setLoadingSubtypes(true);
        getProductSubtypes(selectedType)
            .then(data => setSubtypes(data))
            .catch(() => setSubtypes([]))
            .finally(() => setLoadingSubtypes(false));
    }, [selectedType]);

    return { types, subtypes, loadingTypes, loadingSubtypes };
}
