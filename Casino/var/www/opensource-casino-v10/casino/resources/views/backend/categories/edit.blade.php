@extends('backend.layouts.app')

@section('page-title', trans('app.edit_category'))
@section('page-heading', $category->title)

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<div class="box box-danger">
		<form action="{{ route('backend.category.update', $category->id) }}" method="POST" enctype="multipart/form-data" id="user-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.edit_category')</h3>
			</div>
			<div class="box-body">
				<div class="row">
					@include('backend.categories.partials.base', ['edit' => true])
				</div>
			</div>
			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_category')
				</button>
				<a href="{{ route('backend.category.delete', $category->id) }}" class="btn btn-danger" data-method="DELETE" data-confirm-title="@lang('app.please_confirm')" data-confirm-text="@lang('app.are_you_sure_delete_category')" data-confirm-delete="@lang('app.yes_delete_him')">
					Delete Category
				</a>
			</div>
			 </form>
	</div>
</section>
@stop