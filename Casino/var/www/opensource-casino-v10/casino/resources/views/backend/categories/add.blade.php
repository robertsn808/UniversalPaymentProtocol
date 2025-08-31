@extends('backend.layouts.app')

@section('page-title', trans('app.add_category'))
@section('page-heading', trans('app.add_category'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<div class="box box-danger">
		<form action="{{ route('backend.category.store') }}" method="POST" enctype="multipart/form-data" id="user-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.add_category')</h3>
			</div>
			<div class="box-body">
				<div class="row">
					@include('backend.categories.partials.base', ['edit' => false, 'profile' => false])
				</div>
			</div>
			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.add_category')
				</button>
			</div>
		</form>
	</div>
</section>

@stop