interface PaginationProps {
    back_page?: string;
    current_page?: number;
    fisrt_page?: string;
    from?: number;
    last_page?: string;
    next_page?: string;
    page_size?: number;
    to?: number;
    total?: number;
    total_pages?: number;
}
export declare class Pagination {
    back_page: string;
    current_page: number;
    fisrt_page: string;
    from: number;
    last_page: string;
    next_page: string;
    page_size: number;
    to: number;
    total: number;
    total_pages: number;
    constructor(pagination: PaginationProps);
}
export {};
